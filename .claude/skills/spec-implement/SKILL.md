---
name: spec-implement
description: Implement the tasks of a planned spec change
argument-hint: <change number> [task numbers, default: all open tasks]
disable-model-invocation: true
---
`$ARGUMENTS` is what the user typed after the skill name. If your tool leaves it unfilled, use the change number or idea the user gave in the conversation.

Implement spec change $ARGUMENTS.

1. Read the change folder (`specs/changes/<number>-*/`) and `AGENTS.md`. Work only on open tasks in `tasks.md`, in order.
2. Implement each task as designed. If the design turns out wrong or the spec is ambiguous, stop and say so; do not change the spec silently. Proposed spec edits go back through the user.
3. Write or update tests for each requirement, tagged `// @req REQ-…`.
4. Tick each task in `tasks.md` when its code and tests are done.
5. Run `npm run spec:check`, `npm run typecheck`, and the tests.
6. Stop and report: tasks done, tests run with results, anything deferred. Do not archive.
