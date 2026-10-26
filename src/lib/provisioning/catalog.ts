// The service catalog: what a project can ask for, and in which order it is
// provisioned. Owned by dashr-nova (the orchestrator); each service's queue
// and workflow names follow dashr-provisioners/contracts.
//
// Order: access groups (project-entitlement) always come first; then services
// run in stages built from `dependsOn`, everything within a stage in parallel.
// Adding a service = an entry here + its provisioner. No workflow change.

export interface ServiceEntry {
  label: string;
  taskQueue: string;
  dependsOn: ServiceName[];
  /** project role -> this service's role. Placeholder mappings: replace with the real roles. */
  roles: Record<"lead" | "member", string>;
  /** native-ad: the service reads AD groups itself. explicit: needs <service>.sync on membership changes. */
  sync: "native-ad" | "explicit";
}

export const SERVICES = {
  rds: { label: "RDS", taskQueue: "rds-provisioner", dependsOn: [], roles: { lead: "read-write", member: "read-write" }, sync: "native-ad" },
  ais: { label: "AIS", taskQueue: "ais-provisioner", dependsOn: [], roles: { lead: "admin", member: "contributor" }, sync: "native-ad" },
  asteria: { label: "Asteria", taskQueue: "asteria-provisioner", dependsOn: [], roles: { lead: "owner", member: "user" }, sync: "native-ad" },
  redcap: { label: "REDCap", taskQueue: "redcap-provisioner", dependsOn: [], roles: { lead: "designer", member: "data-entry" }, sync: "explicit" },
  apollo: { label: "Apollo", taskQueue: "apollo-provisioner", dependsOn: [], roles: { lead: "admin", member: "user" }, sync: "native-ad" },
} as const satisfies Record<string, Omit<ServiceEntry, "dependsOn"> & { dependsOn: readonly string[] }>;

export type ServiceName = keyof typeof SERVICES;
export const SERVICE_NAMES = Object.keys(SERVICES) as ServiceName[];

/** Services `selected` needs but didn't select. */
export function missingDependencies(selected: ServiceName[]): { service: ServiceName; needs: ServiceName }[] {
  return selected.flatMap((s) =>
    (SERVICES[s].dependsOn as readonly ServiceName[]).filter((d) => !selected.includes(d)).map((needs) => ({ service: s, needs })),
  );
}

/** Stages from dependencies: each service runs one stage after everything it depends on. */
export function buildStages(selected: ServiceName[]): ServiceName[][] {
  const stages: ServiceName[][] = [];
  const placed = new Set<ServiceName>();
  let remaining = [...selected].sort();
  while (remaining.length) {
    const ready = remaining.filter((s) => (SERVICES[s].dependsOn as readonly ServiceName[]).every((d) => placed.has(d)));
    if (!ready.length) throw new Error(`dependency cycle among: ${remaining.join(", ")}`);
    stages.push(ready);
    ready.forEach((s) => placed.add(s));
    remaining = remaining.filter((s) => !placed.has(s));
  }
  return stages;
}
