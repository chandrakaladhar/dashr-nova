# 0001: Workflow run tracking

- **Status:** Proposed
- **Owner:** dashr-nova
- **Capabilities:** project-provisioning

## Why
The dashr-nova database shows each service's current status but not the
history of workflow runs behind it: when each provisioning, sync or retry
started and ended, and how. Operators must open Temporal to answer "what ran
for this project, and when?", and Temporal deletes closed workflows after its
retention period. A workflow that is terminated or times out cannot record
its own end, so its status can stay "running" forever.

## What changes
- Every workflow run for a project (the project workflow and every child it
  starts) is recorded in dashr-nova when it starts and when it ends, with its
  outcome and error.
- Runs that end without recording it (terminated, timed out, lost) are
  reconciled from Temporal's own record within ten minutes.
- The project page shows the run history.

## Out of scope
- Step-level progress inside a provisioner (e.g. "GPU step 3 of 7"); possible
  later via Temporal queries.
- Retrying failed services from the UI.
- Alert routing (the reconciler logs; wiring logs to alerts is platform work).

## Impact
- **Contracts:** database (new table, additive). No HTTP, workflow or policy contract change; provisioners are unaffected.
- **Other repos:** none.
- **Risks and rollout:** migration first; running workflows started before the change have no start rows; the reconciler ignores runs it has no row for.

## Open questions
- [ ] Reconcile interval and age threshold: 5 and 10 minutes proposed.
- [ ] Keep run history forever, or prune after N months?
