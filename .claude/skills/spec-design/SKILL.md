---
name: spec-design
description: Design an approved spec change - design.md, ADRs, contract changes
argument-hint: <change number, e.g. 0001>
disable-model-invocation: true
---
`$ARGUMENTS` is what the user typed after the skill name. If your tool leaves it unfilled, use the change number or idea the user gave in the conversation.

Design spec change $ARGUMENTS.

1. Read `specs/changes/$ARGUMENTS-*/proposal.md` and `spec-delta.md`. If the proposal still has open questions, ask the user about them first.
2. Read the code the change touches, the relevant ADRs in `specs/decisions/`, and `specs/contracts/`.
3. Write `design.md` from `specs/templates/design.md`: approach, data, flows, contracts, failure modes, alternatives, test plan naming the requirement IDs.
4. Fill in the constitution check honestly. If the design breaks a principle, stop and tell the user: the constitution must be amended first, or the design must change.
5. If a decision will outlive this change, add an ADR in `specs/decisions/` from the template.
6. Update `specs/contracts/openapi.yaml` (with `x-requirements`) if the HTTP API changes. Additive only.
7. Run `npm run spec:check` and `npm run spec:api`.
8. Stop and summarize the design for review. No implementation code yet.
