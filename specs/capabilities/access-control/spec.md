# Access control

- **Prefix:** REQ-AUTHZ
- **Owner:** dashr-nova (enforcement); rules in dashr-nova-policies
- **Code:** `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/context.ts`, `src/lib/policy.ts`, `src/lib/opa.ts`

Who is calling, and whether they may do what they ask. Identity is a
development stub until a real login exists; decisions come from OPA.

## Requirements

### REQ-AUTHZ-001: Decisions come from the policy service and fail closed
When an action needs authorization, the system shall ask the policy service, and if the service cannot be reached, errors, or gives no decision, the system shall not perform the action.

#### Scenario: policy service down
- **Given** the policy service is unreachable
- **When** a protected action is requested
- **Then** the action is not performed

### REQ-AUTHZ-002: Development identities exist only in development
While the application runs in the `local` or `development` environment, the system shall accept a development identity (user and roles from the `x-dev-user`/`x-dev-roles` headers or the dev login on the web pages); in every other environment it shall treat such requests as anonymous.

#### Scenario: production ignores dev headers
- **Given** the environment is `production`
- **When** a request carries `x-dev-roles: platform-admin`
- **Then** it is treated as anonymous (401 where sign-in is required)

### REQ-AUTHZ-003: Reading projects requires permission
When a user lists or opens projects, the system shall require the policy's permission to read projects, and shall answer 404 for a project that does not exist.

#### Scenario: researcher reads
- **Given** a researcher
- **When** they open the projects list
- **Then** they see the projects

### REQ-AUTHZ-004: Reports are readable by researchers and deletable by admins
When a user reads reports the system shall require read permission, and when a user deletes reports it shall require delete permission, answering 401 without a user and 403 without permission.

#### Scenario: researcher deletes
- **Given** a researcher
- **When** they call DELETE /api/reports
- **Then** the response is 403

## Known gaps
Behavior that falls short of the constitution today. Each should become a change.

- **Project existence is revealed before authorization.** Opening a project
  answers 404 for a missing ID before checking read permission, so an
  unauthorized user can tell which IDs exist (constitution VII).
- **Lists are not filtered per user.** Anyone allowed to read projects sees all
  of them; there is no "projects I may see" rule yet.
- **No real login.** Identity is the development stub; outside development
  every protected action answers 401.
