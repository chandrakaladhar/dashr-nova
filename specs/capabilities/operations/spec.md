# Operations

- **Prefix:** REQ-OPS
- **Owner:** dashr-nova
- **Code:** `src/instrumentation.ts`, `src/lib/config.ts`, `src/app/api/health`, `src/app/api/ready`, `src/app/api/dependencies`, `src/orchestrator/worker.ts`

How the application behaves for the platform that runs it: startup,
health, and background housekeeping.

## Requirements

### REQ-OPS-001: Invalid configuration stops startup
If the configuration is invalid at startup, the system shall exit immediately with a message naming every invalid setting.

#### Scenario: missing database URL
- **Given** DATABASE_URL is not set
- **When** the application starts
- **Then** it exits, naming DATABASE_URL

### REQ-OPS-002: Liveness never depends on other services
When asked for liveness, the system shall answer 200 while the process runs, regardless of the database, Temporal or OPA.

#### Scenario: database down
- **Given** the database is unreachable
- **When** GET /api/health
- **Then** the response is 200 `{ status: "ok" }`

### REQ-OPS-003: Readiness depends only on the database
When asked for readiness, the system shall answer 200 if the database is reachable and 503 otherwise; Temporal and OPA outages shall not affect readiness.

#### Scenario: OPA down, database up
- **Given** OPA is unreachable and the database is reachable
- **When** GET /api/ready
- **Then** the response is 200

### REQ-OPS-004: Dependency status is reported
When asked for dependency status, the system shall report each of database, Temporal and OPA as ok, disabled or unreachable, answering 503 if any enabled dependency is unreachable.

#### Scenario: Temporal unreachable
- **Given** Temporal is enabled but unreachable
- **When** GET /api/dependencies
- **Then** the response is 503 and temporal is `unreachable`
