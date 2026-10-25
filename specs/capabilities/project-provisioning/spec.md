# Project provisioning

- **Prefix:** REQ-PROV
- **Owner:** dashr-nova (orchestration); each provisioner team owns how its service is provisioned
- **Code:** `orchestrator/workflows/project-provisioning.ts`, `orchestrator/activities/`, `lib/provisioning/catalog.ts`, `app/projects/[id]/`

Turning an accepted project into working access: access groups first, then
every selected service, then keeping access in step as blocked members become
eligible. Provisioners do the work in their own systems; this capability
decides order, records state, and handles outcomes.

## Requirements

### REQ-PROV-001: Members are checked before they get access
When provisioning starts, the system shall check every member against the membership policy, give access only to eligible members, and record each blocked member with the rule codes that block them.

#### Scenario: terms not accepted
- **Given** a member who has not accepted the current terms
- **When** provisioning starts
- **Then** the member is `blocked` with reason MBR-TERMS-NOT-ACCEPTED
- **And** they are not in any access group

### REQ-PROV-002: Access groups come first
When provisioning starts, the system shall create the project's access groups (one per service role, with eligible members) before any service is provisioned.

#### Scenario: order
- **Given** a project with RDS and REDCap selected
- **When** provisioning runs
- **Then** no service is provisioning until the access groups are `active`

### REQ-PROV-003: No access groups, no services
If the access groups cannot be created, the system shall mark the project `failed`, every service `skipped` with the reason, and eligible members `failed`.

#### Scenario: AD unavailable for good
- **Given** access group creation fails permanently
- **When** provisioning runs
- **Then** the project is `failed` and every service is `skipped` with "access groups failed: <reason>"

### REQ-PROV-004: Services run in dependency order, in parallel where possible
When access groups are ready, the system shall provision the selected services in stages derived from the service catalog's dependencies, all services within a stage at the same time.

#### Scenario: no dependencies
- **Given** RDS, AIS, Asteria, REDCap and Apollo selected and none depends on another
- **When** access groups are ready
- **Then** all five are `provisioning` at the same time

### REQ-PROV-005: One service's failure doesn't stop the others
If a service fails to provision, the system shall record it as `failed` with the provisioner's own error message, continue with every service that does not depend on it, and mark those that do as `skipped`.

#### Scenario: Apollo fails
- **Given** Apollo's provisioner fails permanently
- **When** provisioning runs
- **Then** Apollo is `failed` with its provisioner's message
- **And** RDS, AIS, Asteria and REDCap still become `active`

### REQ-PROV-006: The project's status reflects the outcome
When provisioning has run every stage, the system shall set the project `active` if every service is active and no member is blocked, and `partially_provisioned` otherwise.

#### Scenario: one service failed
- **Given** a project with five services, one of which fails
- **When** every stage has run
- **Then** the project is `partially_provisioned`

### REQ-PROV-007: Blocked members are admitted when they become eligible
While a member is blocked, when they accept the terms, the system shall re-check them, and if they are now eligible add them to the access groups, re-apply access in services that cannot read access groups themselves, and mark them `active`.

#### Scenario: accepts terms later
- **Given** a member blocked by MBR-TERMS-NOT-ACCEPTED on a provisioned project
- **When** they accept the current terms
- **Then** they become `active` without reprovisioning any service

### REQ-PROV-008: Blocked members expire
If a member is still blocked 7 days after provisioning started, the system shall mark them `expired` and stop waiting for them.

#### Scenario: never accepts
- **Given** a blocked member
- **When** 7 days pass without them becoming eligible
- **Then** they are `expired`

### REQ-PROV-009: Provisioning survives restarts
If the orchestrator or a provisioner restarts during provisioning, the system shall continue from where it was without repeating completed steps.

#### Scenario: orchestrator redeployed while a member is blocked
- **Given** a project waiting on a blocked member
- **When** the orchestrator restarts and the member then accepts the terms
- **Then** the member becomes `active`

### REQ-PROV-010: Progress is visible on the project page
When a user views a project, the system shall show each stage, each service's status with its resource reference or error, and each member's status with reasons, refreshing automatically while provisioning runs or members are blocked.

#### Scenario: watching provisioning
- **Given** a project that is provisioning
- **When** its page is open
- **Then** status changes appear without reloading
