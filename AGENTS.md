# Working in dashr-nova (humans and AI agents)

This repository is **spec-driven**. Read `specs/README.md` and
`specs/constitution.md` before changing behavior.

## Rules
1. **No behavior change without a spec.** If a user, operator or other system
   could observe the difference, the change starts in `specs/changes/NNNN-slug/`
   (proposal and spec delta) and ends with the delta merged into
   `specs/capabilities/`. Refactors, typo fixes and dependency bumps are exempt.
2. **Don't invent requirements.** If the spec is silent or ambiguous, ask, or
   write the question under "Open questions" in the proposal. Don't guess in code.
3. **Check the design against the constitution** (`design.md` has the table).
   Breaking a principle means amending the constitution first.
4. **Tag tests** with the requirements they prove: `// @req REQ-PRJ-004`.
5. **Run `npm run spec:check`** (and `npm run typecheck`) before finishing.
6. **Contracts change additively**: `specs/contracts/openapi.yaml`, workflow
   contracts in dashr-provisioning-common, policy inputs in dashr-nova-policies.
7. **Record lasting decisions** as ADRs in `specs/decisions/`.
8. **Keep `CATALOG.md` current**: adding, removing or repurposing a file
   updates its entry in the same change.

## Steps (agent skills)
The steps are portable skills in `.claude/skills/` (Agent Skills format);
`.agents/skills` links to the same folder for Codex and other tools. In Claude
Code type the command; in other tools pick the skill by name.

| Step | Command | Produces |
|---|---|---|
| Propose | `/spec-propose <idea>` | `changes/NNNN-slug/proposal.md`, `spec-delta.md` |
| Design | `/spec-design NNNN` | `design.md`, ADRs, contract changes |
| Plan | `/spec-tasks NNNN` | `tasks.md` |
| Implement | `/spec-implement NNNN` | code and tagged tests, tasks ticked |
| Archive | `/spec-archive NNNN` | delta merged into capabilities, folder moved to `archive/` |

Each step stops for human review before the next.

## Where things are
Full per-file map: `CATALOG.md`.
- `src/lib/`: domain functions; every entry point goes through them (ADR 0003)
- `src/app/`: pages, server actions, API routes (thin adapters)
- `src/orchestrator/`: the worker process: `worker.ts`, `workflows/`, `activities/` (ADR 0005)
- `db/migrations/`: schema
- `specs/`: capabilities, changes, decisions, contracts, templates
