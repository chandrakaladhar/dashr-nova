# 0003: Authorization happens in domain functions, not at the HTTP edge

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
Next.js has three ways into data: server components, server actions (which are
public POST endpoints) and API route handlers. Workflow activities are a
fourth. Checks in route middleware would leave the others unprotected.

## Decision
Every protected operation is a domain function in `lib/` taking a
`RequestContext` (who, request ID, environment). It validates, asks OPA,
and touches data. Entry points only build the context and translate results
(404/403/redirect/error state).

## Consequences
- One pipeline per operation, identical for pages, actions, API and workflows.
- Next.js `middleware.ts` is not used for authorization (Edge runtime, no DB).
- Data passed to client components must be trimmed DTOs, never raw rows.

## Alternatives
- A `withAuthz` wrapper on route handlers only: misses pages and actions.
