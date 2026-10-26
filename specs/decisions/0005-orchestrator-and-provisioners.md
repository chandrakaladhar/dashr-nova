# 0005: dashr-nova orchestrates; provisioners are separate workers in separate repos

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
Seven provisioners (adgroup, project-entitlement, RDS, AIS, Asteria, REDCap,
Apollo) are owned by different teams, need different credentials and scale
differently. Access groups are a prerequisite for every service.

## Decision
- dashr-nova runs its own worker (queue `dashr-nova-orchestration`). Its
  workflow decides order, starts provisioners as child workflows by name, and
  is the only writer of provisioning state in the dashr-nova database.
- Each provisioner is a Python worker in its own repo, on its own queue,
  implementing a standard contract (`<service>.provision/.sync/.deprovision`)
  from `dashr-provisioning-common`. Provisioners never touch the dashr-nova
  database; they return results.
- Order: access groups (project-entitlement, which uses adgroup) first, then
  services in stages from the catalog's dependencies, parallel within a stage.

## Consequences
- Teams release, scale and hold credentials independently.
- Contracts cross languages by name and JSON; changes are additive (constitution X).
- A new service needs a provisioner and a catalog entry, not workflow changes.

## Alternatives
- One worker for everything: shared credentials and releases across teams.
- Provisioners writing their own status to the database: many writers, no single owner of project state.
