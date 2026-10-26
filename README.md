# dashr-nova

Source for the DASHR Nova Next.js application, its container image, and its
Helm chart. Deployment configuration lives in **dashr-nova-deploy**; the
cluster, shared services and secrets live in **dashr-platform-gitops**.

**This repo is spec-driven**: behavior is specified in [`specs/`](specs/README.md)
before it is built. Start with `specs/README.md`, `specs/constitution.md` and
`AGENTS.md`; `npm run spec:check` validates the specs.

```
specs/                     capabilities (what the app does), changes in flight,
                           decisions (ADRs), contracts (OpenAPI), templates
src/                       all application code (imported as @/...)
  app/                     Next.js App Router: pages, server actions, API routes
    api/health             liveness: the process is up
    api/ready              readiness: the database is reachable
    api/dependencies       status of every dependency (used by helm test)
    api/projects           create a project (202; provisioning runs in the background)
    api/reports            example route authorized by OPA
    projects/              project list, new project form, project status page
  lib/                     domain layer: every entry point goes through it
    config.ts              the configuration contract, validated at startup
    projects.ts            create/read projects: validation, OPA, transaction, outbox
    auth.ts, session.ts    current user (dev stub until a login exists)
    policy.ts, opa.ts      OPA decisions (fail closed)
    outbox.ts              transactional outbox for starting workflows
    provisioning/          service catalog and the provisioner contract (TypeScript side)
    temporal/              Temporal client and names shared with workflows
  orchestrator/            the orchestrator worker process (npm run worker)
    worker.ts              entry point: registers workflows and activities, runs the outbox sweeper
    workflows/             project provisioning workflow (deterministic sandbox)
    activities/            the workflow's DB/OPA steps
  instrumentation.ts       fails the pod at startup if configuration is invalid
db/migrations/             SQL schema
public/                    static files (Next.js serves them from the top level)
charts/dashr-nova/         Helm chart with an explicit dependency contract
scripts/                   build-local.sh, spec-check.mjs
.env.example               template for .env.local (npm run dev outside Kubernetes)
```

Every file, what it is for and which process runs it: [`CATALOG.md`](CATALOG.md).

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
2. **Startup**: `src/instrumentation.ts` validates the environment and exits with
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

`.env.example` is committed documentation of the variables `src/lib/config.ts`
reads; `.env.local` holds your real values and is git-ignored. In Kubernetes
none of these files are used: the chart sets the environment.

- `TEMPORAL_ENABLED` and `OPA_ENABLED` **default to `true`**, which makes
  `TEMPORAL_ADDRESS` and `OPA_URL` required. The example sets both to `false`
  so the app starts with only a database.
- `APP_ENV` is **required** (`local`, `development`, `staging`, `production`).
  Only `local` and `development` accept development identities.
- `DB_POOL_MAX`, `TEMPORAL_NAMESPACE` (`default`) and `OPA_POLICY_PATH` have
  defaults and can be left out.
- If startup fails, the error lists every invalid variable at once.

**Against the local cluster's services.** Port-forward them (one per terminal)
and point `.env.local` at localhost:

```bash
kubectl -n database port-forward svc/platform-pg-rw 5432:5432
kubectl -n temporal port-forward svc/temporal-frontend 7233:7233
kubectl -n policy   port-forward svc/opa 8181:8181
```

```bash
DATABASE_URL=postgresql://dashr_nova:<password>@localhost:5432/dashr_nova
TEMPORAL_ENABLED=true
TEMPORAL_ADDRESS=localhost:7233
OPA_ENABLED=true
OPA_URL=http://localhost:8181
```

Get the password with `bao kv get -field=password kv/dashr-nova/db` (OpenBao
port-forwarded and logged in; see the dashr-platform-gitops README).

Keep `.env.local` out of image builds: `.dockerignore` does not exclude it, so
`COPY . .` would copy it into the build stage, where `npm run build` reads it.

## Release to the local cluster

```bash
# 1. Build and load into the cluster
./scripts/build-local.sh 0.1.0 docker-desktop    # Docker Desktop Kubernetes
./scripts/build-local.sh 0.1.0 kind dev          # kind, k3d, minikube, k3s and containerd save ./images/*.tar first

# 2. If the chart changed, bump charts/dashr-nova/Chart.yaml version
#    (see charts/dashr-nova/CHANGELOG.md), commit and tag
git tag v0.1.0 && git push --tags

# 3. In dashr-nova-deploy, set the image tag (and chart tag if needed), commit, push
```

Flux reads the chart from this repo at the Git ref set in dashr-nova-deploy,
so a chart change reaches a cluster only when that ref is changed there. (The
local overlay follows `main`, so chart changes reach the local cluster on
push.)

Build tips:

- **Use a new version for every build.** The deployment uses `pullPolicy:
  Never` and Kubernetes does not restart pods for a tag it already runs.
- **`docker-desktop` target**: Docker Desktop's Kubernetes can pull from the
  local Docker image store, but `pullPolicy: Never` never asks. The target
  starts a throwaway pod with `IfNotPresent` to copy the image onto the node,
  then removes it; no tar is written. The optional third argument is the
  kubectl context (default `docker-desktop`).
- **Behind a TLS-inspecting proxy** (Zscaler and similar), npm fails with
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Pass the proxy's root CA:
  ```bash
  security find-certificate -c "Zscaler Root CA" -p /Library/Keychains/System.keychain > /tmp/corp-ca.pem
  CORP_CA_FILE=/tmp/corp-ca.pem ./scripts/build-local.sh 0.1.1 docker-desktop
  ```
  It reaches `npm ci` and `npm run build` as a BuildKit secret
  (`NODE_EXTRA_CA_CERTS`) and is never written to an image layer.
- **`ErrImageNeverPull`** on the pod means the tag in dashr-nova-deploy is not
  on the node yet: build or load that exact tag, then delete the pod.

## Authorization (OPA)

Routes ask the platform's OPA service for each decision; the rules live in
dashr-platform-gitops (`platform/opa/policies/dashr-authz.rego`), so changing
who may do what is a policy commit, not an app release.

```ts
import { authorize, getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const denied = await authorize(getCurrentUser(request), "read", "reports");
  if (denied) return denied;          // 401 not signed in, 403 denied
  // ...
}
```

OPA receives `{"input": {"user": {"id", "roles"}, "action", "resource"}}`.
Any OPA error denies (fail closed).

There is no login yet. Until there is, `getCurrentUser` accepts roles from an
`x-dev-roles` header **only when `APP_ENV` is `local` or `development`**; in
staging and production it returns null and protected routes answer 401.
Replace it with the real session (OIDC) before relying on it.

```bash
curl -H "Host: dashr-nova.dashr.local" localhost/api/reports                                  # 401
curl -H "Host: dashr-nova.dashr.local" -H "x-dev-roles: researcher" localhost/api/reports     # 200
curl -X DELETE -H "Host: dashr-nova.dashr.local" -H "x-dev-roles: researcher" localhost/api/reports      # 403
curl -X DELETE -H "Host: dashr-nova.dashr.local" -H "x-dev-roles: platform-admin" localhost/api/reports  # 204
```

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
