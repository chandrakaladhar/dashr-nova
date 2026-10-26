# 0004: Workflows are started through a transactional outbox

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
Accepting a project writes to Postgres and starts a Temporal workflow: two
systems with no shared transaction. A crash between them leaves a project
that is never provisioned.

## Decision
The intent to start is written to an `outbox` table in the same transaction
as the project. The app starts the workflow right after commit; a sweeper in
the orchestrator worker starts anything still pending after 30 seconds.
Workflow IDs are deterministic and reuse is rejected, so starts are idempotent.

## Consequences
- No lost starts and no duplicate workflows (REQ-PRJ-008).
- Every new "record then start" flow uses the outbox, not a direct start.

## Alternatives
- Start the workflow first and let it create the record: the API could no
  longer return validation, policy and conflict errors synchronously.
