import Link from "next/link";
import { notFound } from "next/navigation";
import { devIdentityAllowed } from "@/lib/auth";
import { DomainError, NotFound } from "@/lib/errors";
import { buildStages, SERVICES } from "@/lib/provisioning/catalog";
import { getProject, type ProjectDetail } from "@/lib/projects";
import { currentContext } from "@/lib/session";
import { projectWorkflowId } from "@/lib/temporal/shared";
import { acceptTermsAsAction } from "../actions";
import { DevIdentity } from "../DevIdentity";
import { StatusBadge } from "../StatusBadge";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await currentContext();
  if (!ctx) {
    return (
      <main className="shell">
        <DevIdentity />
        <p className="lede">Sign in to see this project.</p>
      </main>
    );
  }

  let project: ProjectDetail;
  try {
    project = await getProject(ctx, id);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    if (err instanceof DomainError) return <main className="shell"><p className="lede">{err.message}</p></main>;
    throw err;
  }

  const running = project.status === "pending" || project.status === "provisioning";
  const waitingOnPeople = project.members.some((m) => m.status === "blocked");
  const byService = new Map(project.services.map((s) => [s.service, s]));
  const stages = buildStages(project.services.map((s) => s.service));
  const workflowId = projectWorkflowId(project.id);

  return (
    <main className="shell wide">
      <AutoRefresh seconds={running ? 2 : waitingOnPeople ? 5 : null} />
      <DevIdentity />
      <p className="crumbs">
        <Link href="/projects">Projects</Link>
      </p>
      <div className="heading">
        <h1>{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>
      {project.description && <p className="lede">{project.description}</p>}

      <h2>Provisioning</h2>
      <ol className="stages">
        <li>
          <div className="stage-title">Access groups</div>
          <div className="step">
            <span>AD groups for every service role</span>
            <StatusBadge status={project.entitlementsStatus} />
            <code className="muted">{project.id}-entitlements-provision</code>
          </div>
        </li>
        {stages.map((stage, i) => (
          <li key={i}>
            <div className="stage-title">{stage.length > 1 ? "Services, in parallel" : "Service"}</div>
            {stage.map((name) => {
              const s = byService.get(name)!;
              return (
                <div key={name} className="step">
                  <span>{SERVICES[name].label}</span>
                  <StatusBadge status={s.status} />
                  <code className="muted">{s.resourceRef ?? `${project.id}-${name}-provision`}</code>
                  {s.error && <span className="field-error">{s.error}</span>}
                </div>
              );
            })}
          </li>
        ))}
      </ol>

      <h2>Members</h2>
      <table className="list">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {project.members.map((m) => (
            <tr key={m.userId}>
              <td>{m.userId}</td>
              <td>{m.role}</td>
              <td>
                <StatusBadge status={m.status} /> {m.reasons.length > 0 && <code className="muted">{m.reasons.join(", ")}</code>}
              </td>
              <td>
                {m.status === "blocked" && m.reasons.includes("MBR-TERMS-NOT-ACCEPTED") && devIdentityAllowed() && (
                  <form action={acceptTermsAsAction.bind(null, project.id, m.userId)}>
                    <button type="submit" className="small">
                      Accept terms as {m.userId} (dev)
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted note">
        Temporal workflow <code>{workflowId}</code>, task queue <code>dashr-nova-orchestration</code>. Each step above is a
        child workflow on its provisioner&apos;s own queue.
      </p>
    </main>
  );
}
