// The provisioning contract, TypeScript side. Must match the JSON Schemas in
// dashr-provisioners/contracts (generated from the Python models). Workflow
// code imports this file, so it must stay free of Node and app imports.

export interface RoleGroup {
  group_dn: string;
  members?: string[];
}

/** <service>.provision / <service>.sync */
export interface ProvisionRequest {
  project_id: string;
  entitlements: Record<string, RoleGroup>; // service role -> AD group
  params: Record<string, unknown>;
}

export interface ProvisionResult {
  resource_ref: string;
  details?: Record<string, unknown>;
}

/** project-entitlement.provision / .sync */
export interface EntitlementRequest {
  project_id: string;
  members: { user_id: string; project_role: string }[];
  services: Record<string, Record<string, string>>; // service -> project role -> service role
}

export interface EntitlementManifest {
  project_id: string;
  services: Record<string, Record<string, RoleGroup>>; // service -> service role -> group
}

export const ENTITLEMENTS = { name: "project-entitlement", taskQueue: "project-entitlement-provisioner" } as const;
