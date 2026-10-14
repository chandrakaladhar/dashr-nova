import { getConfig } from "./config";
import { isAllowed } from "./opa";

export interface User {
  id: string;
  roles: string[];
}

// Environments where a request may claim its own roles, for trying policies
// before a login exists. Never add staging or production here.
const DEV_ENVS = new Set(["local", "development"]);

/**
 * The user making the request, or null if not signed in.
 *
 * TODO: replace with the real session once a login (OIDC) exists. Until then,
 * in local and development only, roles come from an `x-dev-roles` header
 * (comma-separated), e.g. `x-dev-roles: researcher`. Everywhere else this
 * returns null, so protected routes answer 401.
 */
export function getCurrentUser(request: Request): User | null {
  if (!DEV_ENVS.has(getConfig().APP_ENV)) return null;
  const header = request.headers.get("x-dev-roles");
  if (!header) return null;
  const roles = header.split(",").map((r) => r.trim()).filter(Boolean);
  return { id: "dev-user", roles };
}

/**
 * Ask OPA whether `user` may perform `action` on `resource`.
 * Returns a 401/403 Response to send back, or null when the request may proceed.
 * OPA errors deny (isAllowed fails closed).
 */
export async function authorize(user: User | null, action: string, resource: string): Promise<Response | null> {
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const allowed = await isAllowed({ user: { id: user.id, roles: user.roles }, action, resource });
  if (!allowed) return Response.json({ error: "forbidden", action, resource }, { status: 403 });
  return null;
}
