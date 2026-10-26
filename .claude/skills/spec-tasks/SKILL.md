---
name: spec-tasks
description: Break a designed spec change into traced tasks
argument-hint: <change number, e.g. 0001>
disable-model-invocation: true
---
`$ARGUMENTS` is what the user typed after the skill name. If your tool leaves it unfilled, use the change number or idea the user gave in the conversation.

Plan spec change $ARGUMENTS.

1. Read `proposal.md`, `spec-delta.md` and `design.md` in `specs/changes/$ARGUMENTS-*/`.
2. Write `tasks.md` from `specs/templates/tasks.md`: small, ordered tasks, each reviewable alone, each naming the requirement IDs it serves. Migrations and contracts come before the code that uses them.
3. Every ADDED and MODIFIED requirement must appear in at least one task. Include a task for tagged tests and a final archive task.
4. Run `npm run spec:check`; it fails if a requirement is not covered.
5. Stop and show the task list for review.
