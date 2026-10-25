# Specs: how DASHR Nova is built

Behavior is specified **before** it is built, and the spec is kept true
**after**. Code review checks the code against the spec; the spec is reviewed
first, by the people who own the behavior.

```
specs/
  constitution.md        non-negotiable principles; every change is checked against them
  capabilities/          THE TRUTH: what the system does now, one folder per capability
    <capability>/spec.md   requirements (REQ-<CAP>-NNN) with scenarios
  changes/               PROPOSED: work in flight, one folder per change
    NNNN-<slug>/
      proposal.md          why, what, scope, impact            (step 1)
      spec-delta.md        ADDED / MODIFIED / REMOVED requirements (step 1)
      design.md            how: data, flows, contracts, risks   (step 2)
      tasks.md             ordered checklist, each task traced to requirement IDs (step 3)
  archive/               DONE: changes after their delta was merged into capabilities/
  decisions/             ADRs: why things are the way they are (NNNN-<slug>.md)
  contracts/             machine-readable interfaces (OpenAPI) and pointers to the others
  templates/             starting points for every file above
```

## The lifecycle of a change

| Step | Output | Gate |
|---|---|---|
| 1. Propose | `changes/NNNN-slug/proposal.md` + `spec-delta.md` | Owners agree on **what** and **why**. No design, no code. |
| 2. Design | `design.md`; ADR if a decision outlives the change; contract changes | Reviewer agrees on **how**; the constitution check passes. |
| 3. Plan | `tasks.md`: small tasks, each naming the requirement IDs it serves | Every ADDED/MODIFIED requirement is covered by a task. |
| 4. Implement | Code + tests tagged `@req REQ-…`; tasks ticked | `npm run spec:check` and tests pass. |
| 5. Archive | Delta merged into `capabilities/*/spec.md`; folder moved to `archive/` | Capabilities describe the system as merged. |

Steps 1–3 can be one pull request for small changes; step 5 happens in the
same pull request as the last implementation commit, so `main` never has code
without a spec or a spec without code.

**Skip the process only for** typo fixes, dependency bumps and refactors that
change no behavior. If a reviewer can observe the difference, it needs a spec.

## Writing requirements

```markdown
### REQ-PRJ-003: Policy violations are reported together
When a create request breaks one or more project policies, the system shall
reject it with 422 and list every violated rule ID.

#### Scenario: two rules broken
- **Given** a sensitive project with no ethics approval and no lead
- **When** it is submitted
- **Then** the response is 422
- **And** it lists PRJ-ETHICS-REQUIRED and PRJ-LEAD-REQUIRED
```

- **IDs are permanent**: `REQ-<CAPABILITY>-<NNN>`. Never reuse or renumber; removed requirements keep their ID in the archive.
- **One behavior per requirement**, written as EARS: *When* trigger / *While* state / *If* unwanted condition, *the system shall* response.
- **At least one scenario each**, concrete enough to be a test.
- **Say what, not how**: no table names or function names in capabilities; those belong in `design.md`.
- **Policy rule codes** (PRJ-ETHICS-REQUIRED, from dashr-nova-policies) may appear in requirements; the rules themselves are specified in that repo.

## Traceability

Tests name the requirements they prove:

```ts
// @req REQ-PRJ-003
test("reports every violated rule", ...)
```

`npm run spec:check` verifies the specs (unique IDs, every requirement has a
scenario, deltas and tasks reference real IDs) and reports requirements that
no test references yet.

## Where other contracts live

| Contract | Source of truth |
|---|---|
| HTTP API | `specs/contracts/openapi.yaml` |
| Workflow contracts (orchestrator ↔ provisioners) | `dashr-provisioning-common/contracts` |
| Policy decisions (input/output, rule IDs) | `dashr-nova-policies` |
| Database schema | `db/migrations/` |
| Deployment configuration | `charts/dashr-nova/values.schema.json` |

## With an AI agent

`AGENTS.md` tells agents to follow this process; in Claude Code the steps are
commands: `/spec-propose`, `/spec-design`, `/spec-tasks`, `/spec-implement`,
`/spec-archive`.
