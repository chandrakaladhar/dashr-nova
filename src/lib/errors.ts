// Domain errors. Domain functions throw these; each entry point translates
// them (route handlers with errorResponse, pages with notFound/redirect,
// server actions with an error state).

export interface Violation {
  code: string;
  message: string;
  field?: string;
}

export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400: the request is malformed. */
export class InvalidRequest extends DomainError {
  constructor(details: unknown) {
    super(400, "invalid_request", "The request is invalid", details);
  }
}

/** 401: nobody is signed in. */
export class Unauthenticated extends DomainError {
  constructor() {
    super(401, "unauthenticated", "Sign in required");
  }
}

/** 403: signed in, but not allowed. */
export class Forbidden extends DomainError {
  constructor() {
    super(403, "forbidden", "You are not allowed to do this");
  }
}

/** 404 */
export class NotFound extends DomainError {
  constructor(what: string) {
    super(404, "not_found", `${what} not found`);
  }
}

/** 409: conflicts with current state (duplicate, wrong status). */
export class Conflict extends DomainError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

/** 422: permitted, but breaks business policy. Codes are policy rule IDs. */
export class PolicyViolation extends DomainError {
  constructor(readonly violations: Violation[]) {
    super(422, "policy_violation", "The request breaks one or more policies", violations);
  }
}

/** 503: a dependency (OPA, database) could not answer. Never treated as allow. */
export class DependencyUnavailable extends DomainError {
  constructor(dependency: string, cause?: unknown) {
    super(503, "unavailable", `${dependency} is unavailable`);
    this.cause = cause;
  }
}

/** Route-handler translation: one error shape for every API route. */
export function errorResponse(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json(
      { error: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      { status: err.status },
    );
  }
  console.error(err);
  return Response.json({ error: "internal", message: "Something went wrong" }, { status: 500 });
}

/** Postgres unique_violation, for mapping constraint errors to 409. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint?: string };
  return e?.code === "23505" && (!constraint || e.constraint === constraint);
}
