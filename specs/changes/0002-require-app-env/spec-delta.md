# Spec delta: 0002 Require the environment name

## MODIFIED

### REQ-AUTHZ-002: Development identities exist only in a named development environment
<capability: access-control>

While the application runs in the `local` or `development` environment, the system shall accept a development identity (user and roles from the `x-dev-user`/`x-dev-roles` headers or the dev login on the web pages); in every other environment it shall treat such requests as anonymous. If the environment is not named, the system shall refuse to start rather than assume one.

#### Scenario: production ignores dev headers
- **Given** the environment is `production`
- **When** a request carries `x-dev-roles: platform-admin`
- **Then** it is treated as anonymous (401 where sign-in is required)

#### Scenario: environment not set
- **Given** `APP_ENV` is not set
- **When** the application starts
- **Then** it exits with a message naming `APP_ENV`
- **And** no request is ever served with a development identity
