# 0002: Require the environment name

- **Status:** In progress
- **Owner:** dashr-nova
- **Capabilities:** access-control

## Why
The application and the Helm chart both default `APP_ENV` to `development`.
Development identities (REQ-AUTHZ-002) are accepted in `development`, so a
deployment that forgets to set `APP_ENV` lets any caller claim any roles, for
example `x-dev-roles: platform-admin`. That is a fail-open default at the
identity layer, against constitution principle IV.

## What changes
- The application refuses to start when `APP_ENV` is not set, naming the
  setting (REQ-OPS-001 already makes invalid configuration stop startup).
  There is no default environment, so development identities are never
  enabled by accident.
- The Helm chart refuses to render when `env.APP_ENV` is not set.

## Out of scope
- A real login (OIDC). Development identities still exist in `local` and
  `development`.
- Any other configuration default.

## Impact
- **Contracts:** configuration: `APP_ENV` becomes required. Chart value
  `env.APP_ENV` loses its default. Not additive, but the deploy overlays
  (local, staging, production) already set it.
- **Other repos:** dashr-nova-deploy: no change needed.
- **Risks and rollout:** a local `.env.local` without `APP_ENV` now stops
  `npm run dev` with a clear message; add `APP_ENV=local`.

## Open questions
- None.
