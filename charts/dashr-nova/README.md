# dashr-nova Helm chart

Deploys the DASHR Nova research dashboard (Next.js).

## Dependencies

| Dependency | Required | Configure with | The app receives |
|---|---|---|---|
| PostgreSQL | Yes | `database.existingSecret` + `database.existingSecretKey` (recommended), or `database.url` | `DATABASE_URL` |
| Temporal | When `temporal.enabled` (default true) | `temporal.address` (`host:port`), `temporal.namespace` | `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` |
| OPA | When `opa.enabled` (default true) | `opa.url`, `opa.policyPath` | `OPA_URL`, `OPA_POLICY_PATH` |

The chart does not install any of these. If a required one is not
configured, `helm install` stops with a message naming the value to set.

**PostgreSQL.** The database and user must exist; the app owns its schema
(see `migrations`). The connection string may go through PgBouncer in
transaction mode, so the app avoids session-level features.

**Temporal.** The namespace given must exist on the Temporal server. Temporal
chart 1.x no longer creates `default`; the DASHR platform creates it through
`server.config.namespaces`. Check with
`temporal operator namespace list --address <temporal.address>`.

**OPA.** The app queries `POST <opa.url>/v1/data/<opa.policyPath>` with
`{"input": {...}}` and treats anything other than `result: true` as deny.

Examples: `examples/values-minimal.yaml` (trial, everything inline),
`examples/values-existing-secrets.yaml` (recommended), and
`examples/secret-example.yaml` (shape of a compatible Secret).

After installing, `helm test <release>` checks that every enabled dependency
is reachable from inside the cluster.

**Images loaded onto nodes** (local clusters): set `image.pullPolicy: Never`
and use a new `image.tag` for every build. `ErrImageNeverPull` means that tag
is not on the node yet (see `scripts/build-local.sh` in the app repo).

## Values

| Key | Default | Description |
|---|---|---|
| `database.existingSecret` | `""` | Secret holding the connection string (recommended) |
| `database.existingSecretKey` | `DATABASE_URL` | Key in that Secret |
| `database.url` | `""` | Connection string given directly (dev/trials) |
| `database.poolMax` | `5` | Maximum connections per pod |
| `temporal.enabled` | `true` | Use Temporal |
| `temporal.address` | `""` | Temporal frontend, `host:port` |
| `temporal.namespace` | `default` | Temporal namespace |
| `opa.enabled` | `true` | Use OPA |
| `opa.url` | `""` | OPA REST API base URL |
| `opa.policyPath` | `dashr/authz/allow` | Decision path |
| `image.repository` | `registry.local/dashr/dashr-nova` | Image repository |
| `image.tag` | `""` | Image tag (required) |
| `image.digest` | `""` | Optional `sha256:` digest |
| `image.pullPolicy` | `IfNotPresent` | `Never` when images are loaded onto nodes |
| `replicaCount` | `1` | Pods |
| `env` | `{APP_ENV: development}` | Extra plain environment variables |
| `istio.virtualService.enabled` | `false` | Create an Istio VirtualService |
| `istio.virtualService.host` | `""` | Hostname |
| `istio.virtualService.gateway` | `""` | Gateway, `namespace/name` |
| `migrations.enabled` | `false` | Pre-install/upgrade migration Job |
| `migrations.command` | `["node","scripts/migrate.js"]` | Migration command |
| `resources` | see values.yaml | Container resources |

Generate this table from the `## @param` comments with
[helm-docs](https://github.com/norwoodj/helm-docs) or Bitnami's
readme-generator-for-helm to keep it in sync.

## Compatibility

See `CHANGELOG.md`. The values contract is versioned like an API: breaking
changes to it bump the chart's major version.
