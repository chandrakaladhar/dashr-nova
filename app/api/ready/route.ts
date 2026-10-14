import { checkDatabaseOnly } from "@/lib/dependencies";

// Readiness: receive traffic only when the database is reachable.
// Temporal and OPA are reported by /api/dependencies but don't gate traffic,
// so a policy or workflow outage degrades features rather than the whole app.
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabaseOnly();
  const ready = database === "ok";
  return Response.json({ status: ready ? "ready" : "not-ready", database }, { status: ready ? 200 : 503 });
}
