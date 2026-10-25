# Tasks: 0001 Workflow run tracking

- [ ] 1. Migration `003_workflow_runs.sql` (REQ-PROV-011, REQ-PROV-012)
- [ ] 2. Activities `recordRunStarted`, `recordRunEnded` with `statusOf(err)` (REQ-PROV-011, REQ-PROV-012)
- [ ] 3. Record start/end in `child()` and around `projectProvisioning` (non-cancellable finally) (REQ-PROV-011, REQ-PROV-012)
- [ ] 4. `reconcileRuns` workflow and activities; schedule created at worker start (REQ-PROV-013, REQ-PROV-014)
- [ ] 5. `getProjectRuns(ctx, id)` and the history table on the project page (REQ-PROV-015)
- [ ] 6. Tests tagged `@req` for each requirement above (REQ-PROV-011, REQ-PROV-012, REQ-PROV-013, REQ-PROV-014, REQ-PROV-015)
- [ ] 7. Archive: merge spec-delta.md into capabilities/project-provisioning, move this folder to archive/
