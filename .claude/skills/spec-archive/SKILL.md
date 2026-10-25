---
name: spec-archive
description: Merge a finished spec change into the capability specs and archive it
argument-hint: <change number, e.g. 0001>
disable-model-invocation: true
---
`$ARGUMENTS` is what the user typed after the skill name. If your tool leaves it unfilled, use the change number or idea the user gave in the conversation.

Archive spec change $ARGUMENTS.

1. Check that every task in `specs/changes/$ARGUMENTS-*/tasks.md` is ticked except the archive task. If not, stop and list what is open.
2. Merge `spec-delta.md` into the capability specs it names:
   - ADDED: append the requirement (without the `<capability: …>` line) to the capability's Requirements.
   - MODIFIED: replace the requirement's whole block.
   - REMOVED: delete the block from the capability.
   Keep requirement IDs exactly as they are.
3. Set the proposal's status to Done, tick the archive task, and move the folder to `specs/archive/`.
4. Remove anything from a capability's "Known gaps" that this change closed.
5. Run `npm run spec:check`; capabilities must now describe the code as it is.
6. Summarize what changed in the capability specs.
