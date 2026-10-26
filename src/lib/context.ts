import { randomUUID } from "node:crypto";
import { getCurrentUser, type User } from "./auth";
import { getConfig } from "./config";

/**
 * Who is acting and in what request. Built once by each entry point (route,
 * page, server action) and passed to every domain function.
 */
export interface RequestContext {
  user: User;
  requestId: string;
  env: string;
}

/** For route handlers. Returns null when nobody is signed in. */
export function contextFromRequest(request: Request): RequestContext | null {
  const user = getCurrentUser(request);
  if (!user) return null;
  return {
    user,
    requestId: request.headers.get("x-request-id") ?? randomUUID(),
    env: getConfig().APP_ENV,
  };
}

/** The "context" part of every OPA input. */
export function policyContext(ctx: RequestContext) {
  return { env: ctx.env, request_id: ctx.requestId };
}
