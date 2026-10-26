# Constitution

Principles every change must satisfy. A design that breaks one either changes
or amends this document first (with an ADR), in its own pull request.

**Version 1.0, 2026-10-16**

## I. Spec first
No observable behavior changes without a spec change in the same pull
request. Capabilities describe the system as merged on `main`.

## II. One image, configured at runtime
The application reads every endpoint and credential from environment variables
at runtime and knows nothing about where its dependencies run. No
`NEXT_PUBLIC_*` endpoints; no environment-specific builds.

## III. Every entry point goes through the domain layer
Pages, server actions, API routes and workflow activities call the same domain
functions in `lib/`. Validation and authorization live there, never only in
an entry point.

## IV. Authorization is decided by OPA and fails closed
The application asks; OPA decides. A missing, undefined or failed decision is
a denial (or a retry in a workflow), never an allow. Business policy (who may,
what is allowed) lives in dashr-nova-policies, not in application code.

## V. Each rule lives in exactly one place
| Kind | Home |
|---|---|
| Data integrity (always true) | Domain code, backed by database constraints |
| Business policy (allow / violations) | OPA |
| Policy parameters (limits, versions) | OPA bundle data |
| Process (order, waiting, retries) | Temporal workflows |
| Calculations | Domain code; OPA receives results as facts |

## VI. Requests are fast; long work is a workflow
A request validates, decides, records and returns. Anything that can take
longer than a request, or must survive a crash, runs as a Temporal workflow
started after commit (transactional outbox). Users see progress from the
database, not by waiting.

## VII. The request pipeline has a fixed order
Authenticate → validate shape → load facts → OPA → state checks → one
transaction → side effects after commit. Checks that reveal data run only
after authorization.

## VIII. The orchestrator is the only writer of provisioning state
dashr-nova's worker orchestrates and records. Provisioners run the child
workflows they are given, return results, and never touch the dashr-nova
database. They are reached only by workflow name and task queue.

## IX. Everything retried is idempotent
Activities, workflows and starts can run more than once and converge:
deterministic workflow IDs, "ensure" rather than "create", unique constraints
as the final guarantee.

## X. Contracts change additively
HTTP API, workflow and policy contracts gain optional fields only. A breaking
change gets a new name or version and runs alongside the old one until every
consumer has moved.

## XI. Secrets never touch Git
Credentials come from the secrets backend (OpenBao locally, AWS Secrets
Manager in production) through External Secrets, by name.

## Amending
Propose the amendment as a change (`changes/NNNN-amend-…`) with an ADR
explaining what is lost and gained. Bump the version above.
