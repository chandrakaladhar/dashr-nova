# Project creation

- **Prefix:** REQ-PRJ
- **Owner:** dashr-nova
- **Code:** `src/lib/projects.ts` (`createProject`), `src/app/api/projects/route.ts`, `src/app/projects/new/`

Accepting a request for a new research project: validating it, deciding
whether it is allowed, recording it, and handing it to provisioning. Ends when
the project is recorded and provisioning is guaranteed to start; what happens
next is [project-provisioning](../project-provisioning/spec.md).

## Requirements

### REQ-PRJ-001: Anonymous requests are rejected
When a create request arrives without a signed-in user, the system shall reject it with 401 and record nothing.

#### Scenario: no identity
- **Given** no user is signed in
- **When** a project is submitted
- **Then** the response is 401 `unauthenticated`

### REQ-PRJ-002: Malformed requests are rejected with field errors
When a create request is malformed, the system shall reject it with 400 and name each invalid field, before any policy is evaluated.

A request is well formed when: the name is 3–120 characters after trimming;
the data classification is public, internal or sensitive; there is at least
one member and no user appears twice; roles are lead or member; services are
known and listed at most once.

#### Scenario: short name and missing fields
- **Given** a signed-in researcher
- **When** they submit `{ "name": "x" }`
- **Then** the response is 400 `invalid_request`
- **And** field errors are given for name, dataClassification and members

### REQ-PRJ-003: Unauthorized users cannot create projects
When the policy does not authorize the user to create projects, the system shall reject the request with 403 and record nothing.

#### Scenario: guest
- **Given** a user whose only role is guest
- **When** they submit a valid project
- **Then** the response is 403 `forbidden`

### REQ-PRJ-004: Policy violations are reported together
When an authorized request breaks one or more project policies, the system shall reject it with 422 and list every violated rule, each with its rule code, field and message.

#### Scenario: two rules broken
- **Given** a sensitive project with no ethics approval and no member with the lead role
- **When** it is submitted
- **Then** the response is 422 `policy_violation`
- **And** it lists PRJ-ETHICS-REQUIRED and PRJ-LEAD-REQUIRED

### REQ-PRJ-005: Project names are unique, case-insensitively
When an authorized, policy-compliant request uses a name that already exists in any letter case, the system shall reject it with 409 `name_taken`, including when two requests race for the same name.

#### Scenario: same name, different case
- **Given** a project named "Reef survey" exists
- **When** "reef SURVEY" is submitted
- **Then** the response is 409 `name_taken`

#### Scenario: name existence is not revealed to unauthorized users
- **Given** a project named "Reef survey" exists
- **When** a guest submits "Reef survey"
- **Then** the response is 403, not 409

### REQ-PRJ-006: Selected services include their dependencies
When a request selects a service without a service it depends on, the system shall reject it with 400 and name the missing dependency.

#### Scenario: dependency missing
- **Given** service A depends on service B in the catalog
- **When** a project selects A but not B
- **Then** the response is 400 with a services field error "A requires B"

### REQ-PRJ-007: Accepted projects are recorded atomically and returned at once
When a request passes every check, the system shall record the project, its members and its selected services together, and respond 202 with the project ID and status `pending` without waiting for provisioning.

#### Scenario: accepted
- **Given** a valid request from a researcher
- **When** it is submitted
- **Then** the response is 202 `{ id, status: "pending" }`
- **And** the project, members and services all exist, or none do

### REQ-PRJ-008: Provisioning of an accepted project always starts, exactly once
When a project has been accepted, the system shall start its provisioning, and shall start it within one minute even if the application crashed or the workflow engine was unavailable at the time of acceptance. Provisioning shall never be started twice for the same project.

#### Scenario: crash after acceptance
- **Given** a project was recorded but its provisioning was not started
- **When** one minute has passed
- **Then** its provisioning has started

### REQ-PRJ-009: No decision means no project
If the policy service cannot be reached or gives no decision, the system shall reject the request with 503 and record nothing.

#### Scenario: OPA down
- **Given** the policy service is unreachable
- **When** a valid project is submitted
- **Then** the response is 503 `unavailable` and no project exists

### REQ-PRJ-010: Creating a project from the web
When a signed-in user creates a project from the web form, the system shall make them its lead, apply the same checks as the API, show any errors (including each violated rule code) on the form, and on success open the project's page.

#### Scenario: form shows violations
- **Given** a signed-in researcher on the new project form
- **When** they submit a sensitive project without an ethics approval ID
- **Then** the form shows PRJ-ETHICS-REQUIRED with its message
