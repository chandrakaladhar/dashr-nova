"use server";

// Server actions: the page-side entry point. Like the API route, they only
// build the context and call the domain functions in lib/, so pages get the
// same validation, OPA checks and transaction as API callers.

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { devIdentityAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { DomainError, InvalidRequest, PolicyViolation, type Violation } from "@/lib/errors";
import { evaluate } from "@/lib/policy";
import { createProject } from "@/lib/projects";
import { currentContext, DEV_ROLES_COOKIE, DEV_USER_COOKIE } from "@/lib/session";
import { notifyTermsAccepted } from "@/lib/temporal/client";

export interface CreateProjectState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  violations?: Violation[];
}

export async function createProjectAction(_prev: CreateProjectState, form: FormData): Promise<CreateProjectState> {
  const ctx = await currentContext();
  if (!ctx) return { error: "Choose a dev identity first (top of the page)." };

  // The signed-in user leads; other members come one per line: "userId" or "userId lead".
  const others = String(form.get("members") ?? "")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([userId]) => userId && userId !== ctx.user.id)
    .map(([userId, role]) => ({ userId, role: role === "lead" ? "lead" : "member" }));
  const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined;

  let projectId: string;
  try {
    const project = await createProject(ctx, {
      name: form.get("name"),
      description: optional("description"),
      dataClassification: form.get("dataClassification"),
      ethicsApprovalId: optional("ethicsApprovalId"),
      members: [{ userId: ctx.user.id, role: "lead" }, ...others],
      services: form.getAll("services"),
    });
    projectId = project.id;
  } catch (err) {
    if (err instanceof PolicyViolation) return { error: err.message, violations: err.violations };
    if (err instanceof InvalidRequest) {
      return { error: err.message, fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> }).fieldErrors };
    }
    if (err instanceof DomainError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong" };
  }
  redirect(`/projects/${projectId}`); // outside try: redirect works by throwing
}

/** Dev only: act as someone else. */
export async function setDevIdentity(form: FormData): Promise<void> {
  if (!devIdentityAllowed()) return;
  const jar = await cookies();
  jar.set(DEV_USER_COOKIE, String(form.get("user") ?? "").trim() || "dev-user", { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set(DEV_ROLES_COOKIE, String(form.get("roles") ?? "").trim(), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/projects", "layout");
}

/**
 * Dev only: record that `userId` accepted the current terms (as if they had
 * done it themselves), then wake the provisioning workflows waiting on them.
 */
export async function acceptTermsAsAction(projectId: string, userId: string): Promise<void> {
  if (!devIdentityAllowed()) return;
  const version = await evaluate<string>("dashr/terms/current_version", {}); // the policy owns the current version
  await getPool().query("insert into user_terms_acceptances (user_id, terms_version) values ($1, $2) on conflict do nothing", [userId, version]);
  await notifyTermsAccepted(userId);
  revalidatePath(`/projects/${projectId}`);
}
