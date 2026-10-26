// Shared by the app, the worker and workflow code. Workflow code is bundled
// into Temporal's sandbox, so this file must stay free of Node and app imports.

/** The orchestrator's queue. Provisioners have their own (see lib/provisioning/catalog.ts). */
export const TASK_QUEUE = "dashr-nova-orchestration";

/** One workflow per project; the ID makes starting it idempotent. */
export const projectWorkflowId = (projectId: string) => `project-${projectId}`;

/** Signal sent to a provisioning workflow when a member accepts the terms. Arg: userId. */
export const TERMS_ACCEPTED_SIGNAL = "termsAccepted";

export type MemberStatus = "pending" | "blocked" | "active" | "failed" | "expired";
export type ProjectStatus = "pending" | "provisioning" | "active" | "partially_provisioned" | "failed";
export type ServiceStatus = "pending" | "provisioning" | "active" | "failed" | "skipped";
export type StepStatus = "pending" | "provisioning" | "active" | "failed";

/** Everything the workflow needs to run, loaded once at its start (an activity). */
export interface ProvisioningPlan {
  members: { user_id: string; project_role: string }[];
  /** service -> project role -> service role */
  roles: Record<string, Record<string, string>>;
  stages: string[][];
  dependsOn: Record<string, string[]>;
  taskQueues: Record<string, string>;
  explicitSync: string[];
  params: Record<string, Record<string, unknown>>;
}

export interface ProvisioningResult {
  status: ProjectStatus;
  services: Record<string, ServiceStatus>;
  members: Record<string, MemberStatus>;
}
