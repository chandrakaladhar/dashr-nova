import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import type { projectProvisioning } from "../../orchestrator/workflows/project-provisioning";
import { getConfig } from "../config";
import { getPool } from "../db";
import { projectWorkflowId, TASK_QUEUE, TERMS_ACCEPTED_SIGNAL } from "./shared";

const globalForTemporal = globalThis as unknown as { temporalClient?: Promise<Client> };

/** One client per process, connected lazily. */
export function getTemporalClient(): Promise<Client> {
  if (!globalForTemporal.temporalClient) {
    const config = getConfig();
    if (!config.TEMPORAL_ENABLED || !config.TEMPORAL_ADDRESS) {
      return Promise.reject(new Error("Temporal is not enabled"));
    }
    globalForTemporal.temporalClient = Connection.connect({ address: config.TEMPORAL_ADDRESS })
      .then((connection) => new Client({ connection, namespace: config.TEMPORAL_NAMESPACE }))
      .catch((err) => {
        globalForTemporal.temporalClient = undefined; // retry the connection next time
        throw err;
      });
  }
  return globalForTemporal.temporalClient;
}

/**
 * Start provisioning for a project. Idempotent: a running workflow is reused,
 * and a finished one is never started again (REJECT_DUPLICATE), so the API and
 * the outbox sweeper can both call this safely.
 */
export async function startProjectProvisioning(projectId: string): Promise<void> {
  const client = await getTemporalClient();
  try {
    await client.workflow.start<typeof projectProvisioning>("projectProvisioning", {
      taskQueue: TASK_QUEUE,
      workflowId: projectWorkflowId(projectId),
      args: [projectId],
      workflowIdConflictPolicy: "USE_EXISTING",
      workflowIdReusePolicy: "REJECT_DUPLICATE",
    });
  } catch (err) {
    if (err instanceof WorkflowExecutionAlreadyStartedError) return; // already ran: nothing to do
    throw err;
  }
}

/**
 * Call when a user accepts the terms: wakes every provisioning workflow that
 * is waiting on them, which re-checks the user against the policy.
 */
export async function notifyTermsAccepted(userId: string): Promise<void> {
  const { rows } = await getPool().query<{ project_id: string }>(
    "select project_id from project_members where user_id = $1 and status = 'blocked'",
    [userId],
  );
  const client = await getTemporalClient();
  await Promise.all(
    rows.map((r) =>
      client.workflow
        .getHandle(projectWorkflowId(r.project_id))
        .signal<[string]>(TERMS_ACCEPTED_SIGNAL, userId),
    ),
  );
}
