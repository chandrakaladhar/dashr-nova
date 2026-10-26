# Contracts

Machine-readable interfaces. A change that touches one updates it in the same
pull request, additively (constitution X).

| Contract | Where | Checked by |
|---|---|---|
| HTTP API | [`openapi.yaml`](openapi.yaml); each operation lists its `x-requirements` | `npm run spec:check` (requirement IDs exist); `npm run spec:api` (OpenAPI lint) |
| Workflows: orchestrator ↔ provisioners | `dashr-provisioning-common/contracts` (JSON Schemas from the pydantic models); TypeScript side in `src/lib/provisioning/contract.ts` | Provisioners' contract tests (workflow names); keep the TS types in step by hand |
| Service catalog (order, roles, queues) | `src/lib/provisioning/catalog.ts` | Type-checked; `buildStages` rejects cycles |
| Policy decisions | `dashr-nova-policies` (`dashr/authz`, `dashr/project/create`, `dashr/membership/provision`) | That repo's `opa test` |
| Database | `db/migrations/` | Applied in order; constraints are the last line of defense |
| Deployment configuration | `charts/dashr-nova/values.schema.json`, `src/lib/config.ts` | `helm lint`; startup validation (REQ-OPS-001) |
