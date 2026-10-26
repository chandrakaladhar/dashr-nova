import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { devUser } from "./auth";
import { getConfig } from "./config";
import type { RequestContext } from "./context";

// The context for pages and server actions (route handlers use
// contextFromRequest). Same RequestContext either way, so every entry point
// calls the same domain functions.
//
// TODO: replace the dev cookies with the real session once OIDC exists.

export const DEV_USER_COOKIE = "dev-user";
export const DEV_ROLES_COOKIE = "dev-roles";

export async function currentContext(): Promise<RequestContext | null> {
  const jar = await cookies();
  const user = devUser(jar.get(DEV_ROLES_COOKIE)?.value, jar.get(DEV_USER_COOKIE)?.value);
  if (!user) return null;
  return {
    user,
    requestId: (await headers()).get("x-request-id") ?? randomUUID(),
    env: getConfig().APP_ENV,
  };
}
