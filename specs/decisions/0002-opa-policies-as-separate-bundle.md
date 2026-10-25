# 0002: Policies live in dashr-nova-policies and ship as an OPA bundle

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
Authorization and business policy change on a different schedule from the
application, and may be owned by people outside the dashr-nova team. A
ConfigMap of Rego in the gitops repo hit size limits, restarted OPA on every
change and had no tests.

## Decision
Rules live in the dashr-nova-policies repo, tested in CI and published as an
OCI bundle to GHCR. The platform OPA polls for it: local clusters follow
`:main`, production pins a released version in `cluster-vars.yaml`.

## Consequences
- Policy changes ship without an app release, and activate without restarts.
- The app/policy input is a contract: additive changes only (constitution X).
- The app must fail closed when OPA has no decision (constitution IV).

## Alternatives
- Rules in the app repo: couples policy releases to app releases.
- Rules compiled to Wasm inside the app: same coupling, loses central decision logs.
- GitHub Releases as the bundle host: needs public repos or API asset lookups.
