// The orchestrator: decides WHAT runs and in which order. The provisioners
// (Python workers, dashr-provisioners/) decide HOW; they are started as child
// workflows by name on their own task queues.
//
//   member checkpoint (OPA)
//   stage 0  project-entitlement.provision → AD groups      required
//   stage 1+ <service>.provision, parallel within a stage    best effort
//   then     wait for blocked members; on acceptance re-sync access
//
// Workflow code runs in Temporal's deterministic sandbox: no I/O, no Node APIs,
// no app imports. Changing step order for running workflows needs patched().
import {
  condition,
  defineSignal,
  executeChild,
  log,
  ParentClosePolicy,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";
import type * as activities from "../activities/project-provisioning";
import { ENTITLEMENTS, type EntitlementManifest, type EntitlementRequest, type ProvisionRequest, type ProvisionResult } from "../../lib/provisioning/contract";
import {
  TERMS_ACCEPTED_SIGNAL,
  type MemberStatus,
  type ProvisioningPlan,
  type ProvisioningResult,
  type ServiceStatus,
} from "../../lib/temporal/shared";

const db = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "2 seconds", backoffCoefficient: 2, maximumInterval: "1 minute", maximumAttempts: 30 },
});

export const termsAcceptedSignal = defineSignal<[userId: string]>(TERMS_ACCEPTED_SIGNAL);

/** How long blocked members have to resolve their block (e.g. accept terms). */
const MEMBER_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Start a provisioner's workflow and wait for its result. */
function child<T>(workflowType: string, taskQueue: string, workflowId: string, input: unknown): Promise<T> {
  return executeChild<(arg: unknown) => Promise<T>>(workflowType, {
    taskQueue,
    workflowId, // deterministic: a retry or replay reattaches instead of starting another
    args: [input],
    parentClosePolicy: ParentClosePolicy.REQUEST_CANCEL,
    workflowRunTimeout: "1 day", // a provisioner stuck for a day is an incident, not a wait
  });
}

/**
 * The provisioner's own message, for the project page. Failures arrive
 * wrapped (child workflow → activity → application error); the innermost
 * one is what the provisioner actually said.
 */
function reason(err: unknown): string {
  let e: unknown = err;
  while (e instanceof Error && e.cause instanceof Error) e = e.cause;
  return e instanceof Error ? e.message : String(e);
}

export async function projectProvisioning(projectId: string): Promise<ProvisioningResult> {
  const services: Record<string, ServiceStatus> = {};
  const members: Record<string, MemberStatus> = {};

  // Register before any await, so signals sent early are not lost.
  const accepted = new Set<string>();
  setHandler(termsAcceptedSignal, (userId) => void accepted.add(userId));

  await db.setProjectStatus(projectId, "provisioning");
  const plan = await db.loadPlan(projectId);
  const allServices = plan.stages.flat();

  // Member checkpoint: only eligible members go into the access groups.
  const eligible = new Set<string>();
  const waiting = new Set<string>();
  await checkMembers(projectId, plan.members.map((m) => m.user_id), eligible, waiting, members);

  // Stage 0: access groups. Every service binds to them, so nothing runs without them.
  await db.setEntitlementsStatus(projectId, "provisioning");
  let manifest: EntitlementManifest;
  try {
    manifest = await child<EntitlementManifest>(
      `${ENTITLEMENTS.name}.provision`,
      ENTITLEMENTS.taskQueue,
      `${projectId}-entitlements-provision`,
      entitlementRequest(projectId, plan, eligible),
    );
  } catch (err) {
    log.error("entitlements failed; nothing else can run", { projectId, reason: reason(err) });
    await db.setEntitlementsStatus(projectId, "failed");
    await db.setServiceStatus(projectId, allServices, "skipped", { error: `access groups failed: ${reason(err)}` });
    await db.setMemberStatus(projectId, [...eligible], "failed", ["access groups failed"]);
    await db.setProjectStatus(projectId, "failed");
    return { status: "failed", services: Object.fromEntries(allServices.map((s) => [s, "skipped"])), members };
  }
  await db.setEntitlementsStatus(projectId, "active");
  await db.setMemberStatus(projectId, [...eligible], "active");
  eligible.forEach((id) => (members[id] = "active"));

  // Stages 1+: services. Parallel within a stage; a failure skips only what depends on it.
  for (const stage of plan.stages) {
    const runnable = stage.filter((s) => plan.dependsOn[s].every((d) => services[d] === "active"));
    const skipped = stage.filter((s) => !runnable.includes(s));
    for (const s of skipped) services[s] = "skipped";
    await db.setServiceStatus(projectId, skipped, "skipped", { error: "a service it depends on failed" });
    await db.setServiceStatus(projectId, runnable, "provisioning");

    const outcomes = await Promise.allSettled(
      runnable.map((s) =>
        child<ProvisionResult>(`${s}.provision`, plan.taskQueues[s], `${projectId}-${s}-provision`, serviceRequest(projectId, s, plan, manifest)),
      ),
    );
    for (const [i, s] of runnable.entries()) {
      const outcome = outcomes[i];
      if (outcome.status === "fulfilled") {
        services[s] = "active";
        await db.setServiceStatus(projectId, [s], "active", { resourceRef: outcome.value.resource_ref });
      } else {
        services[s] = "failed";
        await db.setServiceStatus(projectId, [s], "failed", { error: reason(outcome.reason) });
      }
    }
  }

  const done = () => allServices.every((s) => services[s] === "active") && !waiting.size;
  await db.setProjectStatus(projectId, done() ? "active" : "partially_provisioned");

  // Blocked members: wait for them, then re-sync access for the new eligible set.
  const deadline = Date.now() + MEMBER_DEADLINE_MS; // deterministic in workflows
  let syncs = 0;
  while (waiting.size) {
    const remaining = deadline - Date.now();
    const signalled = remaining > 0 && (await condition(() => [...waiting].some((id) => accepted.has(id)), remaining));
    if (!signalled) {
      await db.setMemberStatus(projectId, [...waiting], "expired");
      waiting.forEach((id) => (members[id] = "expired"));
      break;
    }
    const recheck = [...waiting].filter((id) => accepted.has(id));
    recheck.forEach((id) => accepted.delete(id));
    const before = eligible.size;
    await checkMembers(projectId, recheck, eligible, waiting, members);
    if (eligible.size === before) continue;

    syncs++;
    manifest = await child<EntitlementManifest>(
      `${ENTITLEMENTS.name}.sync`,
      ENTITLEMENTS.taskQueue,
      `${projectId}-entitlements-sync-${syncs}`,
      entitlementRequest(projectId, plan, eligible),
    );
    const synced = recheck.filter((id) => eligible.has(id));
    await db.setMemberStatus(projectId, synced, "active");
    synced.forEach((id) => (members[id] = "active"));
    // Services that can't read AD groups need their access re-applied.
    const explicit = plan.explicitSync.filter((s) => services[s] === "active");
    const results = await Promise.allSettled(
      explicit.map((s) => child<ProvisionResult>(`${s}.sync`, plan.taskQueues[s], `${projectId}-${s}-sync-${syncs}`, serviceRequest(projectId, s, plan, manifest))),
    );
    results.forEach((r, i) => r.status === "rejected" && log.warn("sync failed", { service: explicit[i], reason: reason(r.reason) }));
    if (done()) await db.setProjectStatus(projectId, "active");
  }

  const status = done() ? "active" : "partially_provisioned";
  await db.setProjectStatus(projectId, status);
  log.info("provisioning finished", { workflowId: workflowInfo().workflowId, status });
  return { status, services, members };
}

/** OPA membership checkpoint for `userIds`; updates the eligible/waiting sets and statuses. */
async function checkMembers(
  projectId: string,
  userIds: string[],
  eligible: Set<string>,
  waiting: Set<string>,
  members: Record<string, MemberStatus>,
): Promise<void> {
  if (!userIds.length) return;
  const facts = await db.loadMemberFacts(userIds);
  const decision = await db.checkMemberEligibility(projectId, facts);
  for (const id of decision.eligible) {
    eligible.add(id);
    waiting.delete(id);
  }
  for (const [id, reasons] of Object.entries(decision.blocked)) {
    waiting.add(id);
    members[id] = "blocked";
    await db.setMemberStatus(projectId, [id], "blocked", reasons);
  }
}

function entitlementRequest(projectId: string, plan: ProvisioningPlan, eligible: Set<string>): EntitlementRequest {
  return { project_id: projectId, members: plan.members.filter((m) => eligible.has(m.user_id)), services: plan.roles };
}

function serviceRequest(projectId: string, service: string, plan: ProvisioningPlan, manifest: EntitlementManifest): ProvisionRequest {
  return { project_id: projectId, entitlements: manifest.services[service] ?? {}, params: plan.params[service] ?? {} };
}
