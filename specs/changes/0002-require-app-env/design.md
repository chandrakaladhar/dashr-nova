# Design: 0002 Require the environment name

## Approach
- `lib/config.ts`: `APP_ENV` is a required, non-empty string with no default.
  `instrumentation.ts` already validates configuration at startup and exits
  on error, and the worker calls `getConfig()` first, so both stop at once.
- Chart: `values.yaml` sets `env: {}`; the `dashr-nova.env` helper uses
  `required` on `env.APP_ENV`, so `helm template` and `helm install` fail
  with a message that says what to set. The chart examples set it explicitly.
- CI: a step asserts that the chart refuses to render without `env.APP_ENV`,
  next to the existing "refuses without a database" step.
- `.env.example` sets `APP_ENV=local`.

## Constitution check
| Principle | How this design satisfies it (or "n/a") |
|---|---|
| II One image, configured at runtime | The environment is still read at runtime; it is only no longer guessed. |
| III Domain layer | n/a |
| IV OPA, fail closed | Removes a fail-open default for identity. |
| VI Long work is a workflow | n/a |
| VIII Orchestrator writes state | n/a |
| IX Idempotent | n/a |
| X Additive contracts | Configuration only: `APP_ENV` becomes required. Every deploy overlay already sets it. |

## Data
None.

## Flows
Unchanged.

## Contracts
Configuration: `APP_ENV` required (app and chart).

## Failure modes
A missing `APP_ENV` stops the pod at startup (CrashLoopBackOff with the
message in the log) or fails the Helm render, instead of running with
development identities.

## Alternatives considered
- Default to `production`: fails safe, but hides a misconfiguration and
  confuses local development. Refusing to start is clearer.
- An extra `DEV_IDENTITY=true` flag: more defence, but one more setting to
  copy between environments; requiring the name closes the hole on its own.

## Test plan
- CI chart step: render without `env.APP_ENV` fails (REQ-AUTHZ-002).
- Unit test once the test harness exists: `getConfig()` without `APP_ENV`
  throws naming it; `devUser()` returns null for `production` (REQ-AUTHZ-002).
