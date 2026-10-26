# 0007: Application code lives under src/

- **Status:** Accepted
- **Date:** 2026-10-26

## Context
The top level mixed three code folders (`app/`, `lib/`, `orchestrator/`) with
a dozen others: specs, chart, migrations, scripts, agent settings and config
files. People and agents had to know which folders hold code, and tools such
as `spec-check` kept a list of them. shadcn/ui and Drizzle would add more code
folders at the top level.

## Decision
All application code lives under `src/`: `src/app/`, `src/lib/`,
`src/orchestrator/` and `src/instrumentation.ts`. The `@/` alias points to
`src/`. Specs, the chart, migrations, scripts, `public/` and config files stay
at the top level.

## Consequences
- "Code is in `src/`" is the whole rule; new code folders (components, the
  Drizzle schema) go under it.
- Paths in docs and specs carry a `src/` prefix. ADRs 0003 and 0005 still say
  `lib/` and `orchestrator/`; read them as `src/lib/` and `src/orchestrator/`.
- `public/` cannot move: Next.js serves it from the project root.

## Alternatives
- Keep the flat layout: Next.js supports it, but the top level keeps growing
  and the code folders stay mixed with everything else.
