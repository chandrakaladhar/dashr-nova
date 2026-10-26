import Link from "next/link";
import { buildStages, SERVICES, SERVICE_NAMES } from "@/lib/provisioning/catalog";
import { currentContext } from "@/lib/session";
import { DevIdentity } from "../DevIdentity";
import { ProjectForm } from "./ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const ctx = await currentContext();
  const services = SERVICE_NAMES.map((name) => ({ name, label: SERVICES[name].label }));
  const stages = buildStages(SERVICE_NAMES);
  return (
    <main className="shell">
      <DevIdentity />
      <p className="crumbs">
        <Link href="/projects">Projects</Link>
      </p>
      <h1>New project</h1>
      <p className="lede">
        Creating a project saves it and returns straight away. Provisioning then runs in the background: access groups
        first, then {stages.map((s) => s.map((n) => SERVICES[n].label).join(", ")).join(", then ")}
        {stages.length === 1 ? " in parallel" : ""}.
      </p>
      {ctx ? <ProjectForm userId={ctx.user.id} services={services} /> : <p className="lede">Sign in above to create a project.</p>}
    </main>
  );
}
