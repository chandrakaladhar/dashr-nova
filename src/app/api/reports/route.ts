import { authorize, getCurrentUser } from "@/lib/auth";

// Example of a route protected by OPA. The decision comes from package
// dashr/authz in dashr-nova-policies (policy/dashr/authz/authz.rego): researchers
// may read, platform admins may do anything. Replace the sample data with the
// real query.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await authorize(getCurrentUser(request), "read", "reports");
  if (denied) return denied;
  return Response.json({ reports: [{ id: "sample", title: "Sample report" }] });
}

export async function DELETE(request: Request) {
  const denied = await authorize(getCurrentUser(request), "delete", "reports");
  if (denied) return denied;
  return new Response(null, { status: 204 });
}
