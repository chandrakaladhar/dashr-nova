# 0006: Changes are specified before they are built

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
DASHR Nova spans an app, an orchestrator, policies and seven provisioners
owned by different teams, much of it built with AI coding agents. Without a
written target, reviews check code against nobody's intent, and agents fill
gaps with guesses.

## Decision
Use spec-driven development (`specs/README.md`): living capability specs with
testable requirements as the source of truth, change proposals as deltas
against them, a constitution checked at design time, ADRs for decisions, and
`npm run spec:check` in CI.

## Consequences
- Every behavior change carries its spec change in the same pull request.
- Tests reference requirement IDs, so coverage of the spec is visible.
- Small overhead for small changes; refactors and dependency bumps are exempt.

## Alternatives
- GitHub Spec Kit / Kiro / OpenSpec as-is: this layout borrows from all three
  (constitution; EARS requirements; living specs plus change deltas) without a
  tool dependency, and adds ADRs and contract pointers.
