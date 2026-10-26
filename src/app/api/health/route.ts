// Liveness: the process is up. Never depends on the database.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
