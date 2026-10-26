import { z } from "zod";
import { policyContext, type RequestContext } from "./context";
import { getPool } from "./db";
import { Conflict, Forbidden, InvalidRequest, isUniqueViolation, NotFound, PolicyViolation, type Violation } from "./errors";
import { dispatch, enqueue } from "./outbox";
import { evaluate } from "./policy";
import { missingDependencies, SERVICE_NAMES, type ServiceName } from "./provisioning/catalog";
import type { MemberStatus, ProjectStatus, ServiceStatus, StepStatus } from "./temporal/shared";

// --- request shape (step 2) -------------------------------------------------
// Only shape and data-integrity rules here. Business policy (ethics approval,
// member limits, who may create projects) is decided by OPA.

export const CreateProjectRequest = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().max(2000).optional(),
  dataClassification: z.enum(["public", "internal", "sensitive"]),
  ethicsApprovalId: z.string().min(1).optional(),
  members: z
    .array(z.object({ userId: z.string().min(1), role: z.enum(["lead", "member"]) }))
    .min(1)
    .refine((m) => new Set(m.map((x) => x.userId)).size === m.length, "each user may appear once"),
  services: z
    .array(z.enum(SERVICE_NAMES as [ServiceName, ...ServiceName[]]))
    .default([])
    .refine((s) => new Set(s).size === s.length, "each service may appear once"),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

interface ProjectCreateDecision {
  allow: boolean;
  authorized: boolean;
  violations: Violation[];
}

export interface CreatedProject {
  id: string;
  status: ProjectStatus;
}

/**
 * Create a project and start provisioning its members.
 * Every entry point (API route, server action) calls this, so all get the
 * same pipeline:
 *
 *   2 shape  →  3 facts  →  4 OPA  →  5 state checks  →  6 transaction  →  7 side effects
 *
 * Step 1 (who is calling) happened when the caller built `ctx`.
 */
export async function createProject(ctx: RequestContext, body: unknown): Promise<CreatedProject> {
  // 2. Shape. OPA only ever sees well-formed input.
  const parsed = CreateProjectRequest.safeParse(body);
  if (!parsed.success) throw new InvalidRequest(parsed.error.flatten());
  const request = parsed.data;
  const missing = missingDependencies(request.services);
  if (missing.length) {
    throw new InvalidRequest({ fieldErrors: { services: missing.map((m) => `${m.service} requires ${m.needs}`) } });
  }

  // 3. Facts. Creation needs none beyond the request; operations on existing
  //    projects load the record here (404 if missing) and pass its attributes.

  // 4. Authorization and business policy, one decision.
  const decision = await evaluate<ProjectCreateDecision>("dashr/project/create/decision", {
    version: 1,
    user: { id: ctx.user.id, roles: ctx.user.roles },
    action: "create",
    resource: {
      type: "project",
      name: request.name,
      data_classification: request.dataClassification,
      ethics_approval_id: request.ethicsApprovalId ?? null,
      members: request.members.map((m) => ({ user_id: m.userId, role: m.role })),
      services: request.services,
    },
    context: policyContext(ctx),
  });
  if (!decision.authorized) throw new Forbidden();
  if (!decision.allow) throw new PolicyViolation(decision.violations);

  // 5. Checks on existing data, only after OPA (so unauthorized callers can't
  //    probe which names exist). A friendly message; step 6 is the guarantee.
  const pool = getPool();
  const taken = await pool.query("select 1 from projects where lower(name) = lower($1)", [request.name]);
  if (taken.rowCount) throw new Conflict("name_taken", "A project with this name already exists");

  // 6. One transaction: the project, its members, and the outbox event.
  const tx = await pool.connect();
  let projectId: string;
  let outboxId: number;
  try {
    await tx.query("begin");
    const { rows } = await tx.query<{ id: string }>(
      `insert into projects (name, description, data_classification, ethics_approval_id, owner_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [request.name, request.description ?? null, request.dataClassification, request.ethicsApprovalId ?? null, ctx.user.id],
    );
    projectId = rows[0].id;
    await tx.query(
      `insert into project_members (project_id, user_id, role)
       select $1, m.user_id, m.role from jsonb_to_recordset($2::jsonb) as m(user_id text, role text)`,
      [projectId, JSON.stringify(request.members.map((m) => ({ user_id: m.userId, role: m.role })))],
    );
    await tx.query(
      "insert into project_services (project_id, service) select $1, unnest($2::text[])",
      [projectId, request.services],
    );
    outboxId = await enqueue(tx, { kind: "project.provision", payload: { projectId } });
    await tx.query("commit");
  } catch (err) {
    await tx.query("rollback").catch(() => {});
    if (isUniqueViolation(err, "projects_name_key")) {
      throw new Conflict("name_taken", "A project with this name already exists"); // lost a race in step 5
    }
    throw err;
  } finally {
    tx.release();
  }

  // 7. Side effects, after commit. If this fails the sweeper starts it later.
  await dispatch(outboxId, { kind: "project.provision", payload: { projectId } });

  return { id: projectId, status: "pending" };
}

// --- reads, for pages and API routes ------------------------------------------

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  dataClassification: string;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null;
  ownerId: string;
  entitlementsStatus: StepStatus;
  services: { service: ServiceName; status: ServiceStatus; resourceRef: string | null; error: string | null }[];
  members: { userId: string; role: string; status: MemberStatus; reasons: string[] }[];
}

async function authorizeRead(ctx: RequestContext, resource: Record<string, unknown>): Promise<void> {
  const allowed = await evaluate<boolean>("dashr/authz/allow", {
    user: { id: ctx.user.id, roles: ctx.user.roles },
    action: "read",
    resource: { type: "project", ...resource },
    context: policyContext(ctx),
  });
  if (!allowed) throw new Forbidden();
}

/** All projects. TODO: filter to the projects this user may see, once that rule exists. */
export async function listProjects(ctx: RequestContext): Promise<ProjectSummary[]> {
  await authorizeRead(ctx, {});
  const { rows } = await getPool().query(
    `select id, name, status, data_classification, created_at from projects order by created_at desc limit 100`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, dataClassification: r.data_classification, createdAt: r.created_at.toISOString() }));
}

export async function getProject(ctx: RequestContext, id: string): Promise<ProjectDetail> {
  if (!z.string().uuid().safeParse(id).success) throw new NotFound("Project");
  const pool = getPool();
  const { rows } = await pool.query("select * from projects where id = $1", [id]);
  if (!rows.length) throw new NotFound("Project");
  const p = rows[0];
  await authorizeRead(ctx, { id: p.id, owner_id: p.owner_id });
  const [services, members] = await Promise.all([
    pool.query("select service, status, resource_ref, error from project_services where project_id = $1 order by service", [id]),
    pool.query("select user_id, role, status, reasons from project_members where project_id = $1 order by role, user_id", [id]),
  ]);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    dataClassification: p.data_classification,
    ownerId: p.owner_id,
    entitlementsStatus: p.entitlements_status,
    createdAt: p.created_at.toISOString(),
    services: services.rows.map((r) => ({ service: r.service, status: r.status, resourceRef: r.resource_ref, error: r.error })),
    members: members.rows.map((r) => ({ userId: r.user_id, role: r.role, status: r.status, reasons: r.reasons })),
  };
}
