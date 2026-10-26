import { getPool } from "../../lib/db";
import { evaluate } from "../../lib/policy";
import { SERVICES, buildStages, type ServiceName } from "../../lib/provisioning/catalog";
import type { MemberStatus, ProjectStatus, ProvisioningPlan, ServiceStatus, StepStatus } from "../../lib/temporal/shared";

// Orchestrator activities: the dashr-nova database and OPA. Provisioning in
// other systems happens in the provisioners (child workflows), never here.
// Each activity is idempotent: Temporal may run it again after a failure.

export interface MemberFacts {
  id: string;
  accepted_terms: string[];
}

export interface EligibilityDecision {
  eligible: string[];
  blocked: Record<string, string[]>; // userId -> rule IDs
}

/** The plan for this run: members, services and their order, from the catalog. */
export async function loadPlan(projectId: string): Promise<ProvisioningPlan> {
  const pool = getPool();
  const [members, services] = await Promise.all([
    pool.query<{ user_id: string; role: string }>("select user_id, role from project_members where project_id = $1 order by user_id", [projectId]),
    pool.query<{ service: ServiceName }>("select service from project_services where project_id = $1", [projectId]),
  ]);
  const selected = services.rows.map((r) => r.service).filter((s) => s in SERVICES);
  return {
    members: members.rows.map((m) => ({ user_id: m.user_id, project_role: m.role })),
    roles: Object.fromEntries(selected.map((s) => [s, { ...SERVICES[s].roles }])),
    stages: buildStages(selected),
    dependsOn: Object.fromEntries(selected.map((s) => [s, [...SERVICES[s].dependsOn]])),
    taskQueues: Object.fromEntries(selected.map((s) => [s, SERVICES[s].taskQueue])),
    explicitSync: selected.filter((s) => SERVICES[s].sync === "explicit"),
    params: {}, // TODO: per-service settings from the project request
  };
}

export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  await getPool().query("update projects set status = $2, updated_at = now() where id = $1", [projectId, status]);
}

export async function setEntitlementsStatus(projectId: string, status: StepStatus): Promise<void> {
  await getPool().query("update projects set entitlements_status = $2, updated_at = now() where id = $1", [projectId, status]);
}

export async function setServiceStatus(
  projectId: string,
  services: string[],
  status: ServiceStatus,
  detail: { resourceRef?: string; error?: string } = {},
): Promise<void> {
  if (!services.length) return;
  await getPool().query(
    `update project_services
        set status = $3, resource_ref = coalesce($4, resource_ref), error = $5, updated_at = now()
      where project_id = $1 and service = any($2)`,
    [projectId, services, status, detail.resourceRef ?? null, detail.error ?? null],
  );
}

export async function setMemberStatus(projectId: string, userIds: string[], status: MemberStatus, reasons: string[] = []): Promise<void> {
  if (!userIds.length) return;
  await getPool().query(
    `update project_members set status = $3, reasons = $4, updated_at = now()
      where project_id = $1 and user_id = any($2)`,
    [projectId, userIds, status, reasons],
  );
}

/** Facts the membership policy decides on. Loaded fresh on every check. */
export async function loadMemberFacts(userIds: string[]): Promise<MemberFacts[]> {
  const { rows } = await getPool().query<{ user_id: string; versions: string[] }>(
    `select u.user_id, coalesce(array_agg(a.terms_version) filter (where a.terms_version is not null), '{}') as versions
       from unnest($1::text[]) as u(user_id)
       left join user_terms_acceptances a using (user_id)
      group by u.user_id`,
    [userIds],
  );
  // TODO: add training status, suspension, ... as the policy needs them
  return rows.map((r) => ({ id: r.user_id, accepted_terms: r.versions }));
}

/** Checkpoint: dashr/membership/provision. OPA unavailable → thrown → retried. */
export async function checkMemberEligibility(projectId: string, users: MemberFacts[]): Promise<EligibilityDecision> {
  const decision = await evaluate<EligibilityDecision>("dashr/membership/provision/decision", {
    version: 1,
    project: { id: projectId },
    users,
  });
  return { eligible: decision.eligible ?? [], blocked: decision.blocked ?? {} };
}
