---
name: spec-propose
description: Start a spec change - proposal and spec delta, no design or code
argument-hint: <what should change, in plain words>
disable-model-invocation: true
---
`$ARGUMENTS` is what the user typed after the skill name. If your tool leaves it unfilled, use the change number or idea the user gave in the conversation.

Create a new spec change for: $ARGUMENTS

1. Read `specs/README.md`, `specs/constitution.md`, and every capability spec this could touch.
2. Pick the next number: one more than the highest in `specs/changes/` and `specs/archive/`. Create `specs/changes/NNNN-<short-slug>/` from `specs/templates/proposal.md` and `specs/templates/spec-delta.md`.
3. Write the proposal: why, what users will observe, out of scope, impact on contracts and other repos. Behavior only; no implementation detail.
4. Write the spec delta. ADDED requirements take the next free ID in their capability (check the capability spec and every open change). MODIFIED requirements restate the full new text. Each requirement: one behavior, EARS wording ("When …, the system shall …"), at least one Given/When/Then scenario, and a `<capability: …>` line.
5. Anything you had to assume goes under "Open questions" in the proposal, not into a requirement.
6. Run `npm run spec:check` and fix what it reports.
7. Stop. Summarize the proposal and list the open questions for the user. Do not design or write code.
