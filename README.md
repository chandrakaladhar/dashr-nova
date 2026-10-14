# dashr-nova

Source for the DASHR Nova Next.js application, its container image, and its
Helm chart. Deployment configuration lives in **dashr-nova-deploy**; the
cluster, shared services and secrets live in **dashr-platform-gitops**.

```
app/                       Next.js App Router
  api/health               liveness: the process is up
  api/ready                readiness: the database is reachable
  api/dependencies         status of every dependency (used by helm test)
lib/config.ts              the configuration contract, validated at startup
lib/db.ts, lib/opa.ts      PostgreSQL pool, OPA decision helper
lib/dependencies.ts        reachability checks
instrumentation.ts         fails the pod at startup if configuration is invalid
charts/dashr-nova/         Helm chart with an explicit dependency contract
scripts/build-local.sh     build image -> ./images/*.tar -> load into local cluster
```

## Configuration contract

The app depends on PostgreSQL, Temporal and OPA, but knows nothing about where
they run. It reads environment variables at runtime, and the chart maps its
values onto them:

| Env var | From chart value | Required |
|---|---|---|
| `DATABASE_URL` | `database.existingSecret`/`existingSecretKey`, or `database.url` | Yes |
| `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` | `temporal.address`, `temporal.namespace` | When `temporal.enabled` |
| `OPA_URL`, `OPA_POLICY_PATH` | `opa.url`, `opa.policyPath` | When `opa.enabled` |

Validation happens three times, each catching problems earlier for a
different audience:

1. **Install time**: `values.schema.json` and the chart's `fail`/`required`
   messages stop `helm install` (or the Flux HelmRelease) and name the value to set.
2. **Startup**: `instrumentation.ts` validates the environment and exits with
   a list of every problem, before the pod takes traffic.
3. **After deploy**: `helm test <release>` checks each dependency is reachable.

Keep endpoints server-side. `NEXT_PUBLIC_*` variables are baked into the
browser bundle at build time and would tie the image to one environment; if
the browser needs a value, serve it from a route handler.

## Develop

```bash
npm install
cp .env.example .env.local     # point DATABASE_URL at a local Postgres
npm run dev
```

## Release to the local cluster

```bash
# 1. Build, save to ./images/ and load into the cluster (example: kind)
./scripts/build-local.sh 0.1.0 kind dev

# 2. If the chart changed, bump charts/dashr-nova/Chart.yaml version
#    (see charts/dashr-nova/CHANGELOG.md), commit and tag
git tag v0.1.0 && git push --tags

# 3. In dashr-nova-deploy, set the image tag (and chart tag if needed), commit, push
```

Flux reads the chart from this repo at the Git ref set in dashr-nova-deploy,
so a chart change reaches a cluster only when that ref is changed there.

## Database schema

The platform provisions the `dashr_nova` role and database and supplies the
connection string; this app owns its schema. Add a migration tool (Prisma,
Drizzle, node-pg-migrate...), point `migrations.command` at it, and set
`migrations.enabled: true`. Connections go through PgBouncer in transaction
mode, so avoid session-level features (session advisory locks, `SET` without
`LOCAL`, `LISTEN/NOTIFY`).

## Later: Harbor

When Harbor is reachable, push images from CI (commented step in
`.github/workflows/ci.yaml`), optionally publish the chart with `helm push`
as an OCI artifact, and switch the repositories in dashr-nova-deploy.
