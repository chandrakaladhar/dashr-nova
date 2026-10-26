# Design: NNNN <title>

## Approach
How the requirements in spec-delta.md are met, in a few paragraphs. Diagrams
welcome (Mermaid renders on GitHub).

## Constitution check
| Principle | How this design satisfies it (or "n/a") |
|---|---|
| III Domain layer | |
| IV OPA, fail closed | |
| VI Long work is a workflow | |
| VIII Orchestrator writes state | |
| IX Idempotent | |
| X Additive contracts | |

## Data
Tables, columns, migrations, and how existing data is handled.

## Flows
Request pipeline, workflow steps, child workflows, signals: whatever moves.

## Contracts
Exact changes to the OpenAPI spec, workflow contracts, policy inputs/outputs.

## Failure modes
What happens on crash, retry, timeout, partial failure, and how it is observed.

## Alternatives considered
What else was possible and why not. Promote to an ADR if it will be asked again.

## Test plan
Which requirements are proven by which tests (unit, integration, end to end).
