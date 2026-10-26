# Spec delta: 0001 Workflow run tracking

## ADDED

### REQ-PROV-011: Every workflow run is recorded when it starts
<capability: project-provisioning>

When a project's workflow, or any child workflow it starts, begins, the system shall record the run with its workflow ID, type, step and start time, with status `running`.

#### Scenario: services start
- **Given** access groups are ready for a project with RDS and REDCap
- **When** their provisioning starts
- **Then** a `running` run exists for `rds.provision` and for `redcap.provision`

### REQ-PROV-012: Every workflow run is recorded when it ends
<capability: project-provisioning>

When a recorded run ends, the system shall record its end time and outcome (`completed`, `failed`, `cancelled`, `terminated` or `timed_out`) and, if it did not complete, its error.

#### Scenario: a service fails
- **Given** Apollo's provisioning is running
- **When** it fails permanently
- **Then** its run is `failed` with the provisioner's message and an end time

#### Scenario: a child is terminated by an operator
- **Given** REDCap's provisioning is running
- **When** an operator terminates it in Temporal
- **Then** its run is `terminated`

### REQ-PROV-013: Runs that could not record their end are reconciled
<capability: project-provisioning>

If a run has been `running` for more than 10 minutes and Temporal shows it closed, the system shall record Temporal's outcome and end time within 5 further minutes, marked as reconciled.

#### Scenario: project workflow terminated
- **Given** a project workflow was terminated by an operator
- **When** the reconciler runs
- **Then** the project's run is `terminated`, marked reconciled

### REQ-PROV-014: Runs missing from Temporal are flagged
<capability: project-provisioning>

If a run is `running` in dashr-nova but Temporal has no record of it, the system shall mark it `lost` and log an error naming the run.

#### Scenario: namespace reset
- **Given** a `running` run whose workflow no longer exists in Temporal
- **When** the reconciler runs
- **Then** the run is `lost` and an error is logged

### REQ-PROV-015: Run history is visible on the project page
<capability: project-provisioning>

When a user views a project, the system shall list its workflow runs, newest first, with type, status, start, end, duration and error.

#### Scenario: after a member was admitted later
- **Given** a project where a blocked member later accepted the terms
- **When** its page is opened
- **Then** the history shows the provision runs and the later sync runs
