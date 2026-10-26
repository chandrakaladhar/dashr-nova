import { getConfig } from "@/lib/config";
import { checkDependencies, type DependencyStatus } from "@/lib/dependencies";

// Rendered per request so the version and dependency status are live.
export const dynamic = "force-dynamic";

const label: Record<DependencyStatus, string> = {
  ok: "Connected",
  disabled: "Not enabled",
  unreachable: "Unreachable",
};

export default async function Home() {
  const config = getConfig();
  const deps = await checkDependencies();
  const rows: [string, DependencyStatus][] = [
    ["Database", deps.database],
    ["Temporal", deps.temporal],
    ["Policy service (OPA)", deps.opa],
  ];
  return (
    <main className="shell">
      <h1>DASHR Nova</h1>
      <p className="lede">
        The deployment is running. <a href="/projects">Projects</a>
      </p>
      <dl className="facts">
        <dt>Version</dt>
        <dd>{config.APP_VERSION}</dd>
        <dt>Environment</dt>
        <dd>{config.APP_ENV}</dd>
        {rows.map(([name, status]) => (
          <div key={name} className="row">
            <dt>{name}</dt>
            <dd className={status === "unreachable" ? "warn" : status === "ok" ? "good" : ""}>{label[status]}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
