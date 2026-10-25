# 0001: Temporal runs all long-running and multi-step work

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
Provisioning a project touches AD, RDS, AIS, Asteria, REDCap and Apollo,
takes seconds to days (AD replication, members accepting terms), must survive
crashes and deploys, and spans teams. A web request cannot wait for it.

## Decision
Every process that outlives a request is a Temporal workflow. The web app
records intent and starts the workflow; workers do the work. Simple
fire-and-forget jobs use Temporal too, so there is one place to see why
anything is stuck.

## Consequences
- Durable state, retries, timers and history come from the engine, not our code.
- Workflow code must be deterministic; I/O lives in activities.
- Changing step order for running workflows needs versioning (`patched()`).
- Temporal is a platform dependency (already run by dashr-platform-gitops).

## Alternatives
- Inngest / Trigger.dev: Next.js-friendly, weaker for multi-team workers and self-hosting.
- Argo Workflows / Airflow: batch pipelines, not long waits on people.
- Message queue choreography: retries, state and ordering would be ours to build; the overall flow would exist nowhere in code.
