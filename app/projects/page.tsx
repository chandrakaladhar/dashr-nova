import Link from "next/link";
import { DomainError } from "@/lib/errors";
import { listProjects, type ProjectSummary } from "@/lib/projects";
import { currentContext } from "@/lib/session";
import { DevIdentity } from "./DevIdentity";
import { StatusBadge } from "./StatusBadge";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const ctx = await currentContext();
  let projects: ProjectSummary[] = [];
  let problem: string | null = ctx ? null : "Sign in to see projects.";
  if (ctx) {
    try {
      projects = await listProjects(ctx);
    } catch (err) {
      if (!(err instanceof DomainError)) throw err;
      problem = err.message;
    }
  }

  return (
    <main className="shell wide">
      <DevIdentity />
      <div className="heading">
        <h1>Projects</h1>
        {ctx && (
          <Link className="button" href="/projects/new">
            New project
          </Link>
        )}
      </div>
      {problem && <p className="lede">{problem}</p>}
      {!problem && projects.length === 0 && <p className="lede">No projects yet.</p>}
      {projects.length > 0 && (
        <table className="list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Data</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/projects/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.dataClassification}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td className="muted">{new Date(p.createdAt).toLocaleString("en-AU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
