# Developing dashr-nova

A guide for new developers: set up your machine, run the app, make a change
the way this repo expects, and use the AI tools that are configured for it.

Reference material lives elsewhere and is linked, not repeated:
configuration in the [README](../README.md), every file in
[CATALOG.md](../CATALOG.md), the rules in [AGENTS.md](../AGENTS.md), the
workflow in [specs/README.md](../specs/README.md).

## 1. Set up your machine

| Tool | Why | Check |
|---|---|---|
| Node.js 22 | CI and the Docker image use Node 22 (npm 10) | `node -v` |
| Git and the GitHub CLI | branches and pull requests | `gh auth status` |
| PostgreSQL client | apply migrations by hand | `psql --version` |
| Docker Desktop with Kubernetes | only for the local cluster (section 3) | `kubectl config current-context` |
| Claude Code and/or Codex | the AI agents (section 5) | `claude --version`, `codex --version` |
| `typescript-language-server` | code navigation for the Claude Code LSP plugin | `npm i -g typescript-language-server typescript` |

**Use Node 22, not a newer one.** A newer npm writes `package-lock.json` in a
form that Node 22's `npm ci` rejects, and CI fails at "Install dependencies".
If that happens, regenerate the lock with `npx npm@10 install --package-lock-only`
and commit it.

**Behind Zscaler or another TLS-inspecting proxy**, npm, Docker and Flux fail
with certificate errors (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `x509: certificate
signed by unknown authority`). Export the proxy's root CA and point Node at it:

```bash
security find-certificate -c "Zscaler Root CA" -p /Library/Keychains/System.keychain > ~/corp-ca.pem
export NODE_EXTRA_CA_CERTS=~/corp-ca.pem      # add to ~/.zshrc
```

Image builds take it as `CORP_CA_FILE` (see the README, "Release to the local cluster").

## 2. Run the app (database only)

The quickest start: the web app with a Postgres database, Temporal and OPA off.

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL to your database
psql "postgresql://…your DATABASE_URL…" -f db/migrations/001_projects.sql
psql "postgresql://…your DATABASE_URL…" -f db/migrations/002_project_services.sql
npm run dev                         # http://localhost:3000
```

- Apply migrations in number order. There is no migration runner yet.
- If the app refuses to start, the error lists every bad variable at once.
  `APP_ENV` is required; `.env.example` sets it to `local`.
- With `APP_ENV=local` the projects pages show a **dev identity switcher**: pick
  a user and roles to act as. API calls take the `x-dev-user` and `x-dev-roles`
  headers instead. Neither works in staging or production.
- With OPA off, authorization fails closed: protected routes deny, and
  creating a project answers 503 because its policy check cannot run.
  Provisioning needs Temporal. For either, use section 3.

## 3. Run everything (local cluster)

The platform (Postgres, Temporal, OPA, Flux) runs in a local Kubernetes
cluster set up by **dashr-platform-gitops**. Follow its README first.

Then either:

- **Run the app on your machine against the cluster's services.** Port-forward
  Postgres, Temporal and OPA and point `.env.local` at them (README,
  "Against the local cluster's services"). Start the worker in a second terminal:
  ```bash
  npx tsx --env-file=.env.local src/orchestrator/worker.ts
  ```
  (`npm run worker` does not read `.env.local`; in Kubernetes the environment
  is set by the chart.)
- **Or run the app in the cluster.** Build the image with
  `./scripts/build-local.sh <new-version> docker-desktop` and set that tag in
  **dashr-nova-deploy** (README, "Release to the local cluster").

How the three repos fit together:

| Repo | Owns |
|---|---|
| dashr-nova (this one) | the app, its image and its Helm chart |
| dashr-nova-deploy | which image and chart version runs where, and per-environment values |
| dashr-platform-gitops | the clusters, shared services, secrets, and `APP_ENV` per cluster |

## 4. Make a change

### Where code goes

Everything that runs is under `src/` and is imported as `@/…`.

| Folder | Put here | Never here |
|---|---|---|
| `src/lib/` | business rules, validation, authorization, database access | framework code (pages, routes) |
| `src/app/` | pages, server actions, API routes: parse the request, call `src/lib/`, render | SQL, permission logic |
| `src/orchestrator/` | the Temporal worker; `workflows/` must stay deterministic (no I/O) | app imports in `workflows/` other than `lib/temporal/shared.ts` and `lib/provisioning/contract.ts` |
| `db/migrations/` | a new numbered SQL file per schema change | edits to a migration that has shipped |

The constitution (`specs/constitution.md`) explains why. Principle III
(every entry point goes through the domain layer) is the one people trip over most.

### Does it need a spec?

**If a user, operator or another system could notice the difference, yes.**
Typo fixes, dependency bumps and refactors that change no behavior do not.
A decision that outlives the change (a library, a layout, a pattern) gets an
ADR in `specs/decisions/` instead.

A behavior change goes through five steps, each reviewed before the next:

| Step | Skill | You get |
|---|---|---|
| Propose | `/spec-propose <idea>` | `specs/changes/NNNN-slug/proposal.md` and `spec-delta.md` |
| Design | `/spec-design NNNN` | `design.md`, ADRs, API contract changes |
| Plan | `/spec-tasks NNNN` | `tasks.md`, each task naming its requirement IDs |
| Implement | `/spec-implement NNNN` | code and tests tagged `// @req REQ-…`, tasks ticked |
| Archive | `/spec-archive NNNN` | the delta merged into `specs/capabilities/`, folder moved to `archive/` |

You can do the steps by hand with `specs/templates/`; the skills just do the
typing. Small changes can put steps 1–3 in one pull request.

### Before you push

```bash
npm run spec:check     # specs: IDs, scenarios, traceability
npm run spec:api       # OpenAPI contract lint
npm run typecheck
npm run build
```

CI runs the same checks plus the Helm chart checks and an image build. Also
update `CATALOG.md` when you add, remove or repurpose a file.

### Branches and pull requests

- Branch from `main`: `feat/…`, `fix/…`, `refactor/…`, `docs/…`.
- Open a pull request with `gh pr create --fill`. Two checks run: `build`
  (CI) and `claude-review` (an automated review that may leave comments).
- Mention `@claude` in a PR or issue comment to ask Claude to answer or make a change.
- If your branch builds on another unmerged branch, push that one first and
  use it as the base (`--base <branch>`).

## 5. The AI tools

`AGENTS.md` holds the rules for every agent. Claude Code reads it through
`CLAUDE.md`; Codex reads it directly. The spec skills live in `.claude/skills/`,
and `.agents/skills` points to the same folder, so both tools share one copy.

### Claude Code

Start it in the repo folder: `claude`. On first start it asks you to trust the
folder and to install the plugins listed in `.claude/settings.json`; accept.

| Plugin | Kind | What it does | How you use it |
|---|---|---|---|
| frontend-design | skill | design guidance for UI work | automatic when you ask for UI |
| typescript-lsp | language server | go to definition, find references, type errors | automatic; needs `typescript-language-server` |
| context7 | MCP server | current docs for Next.js, Temporal, zod, … | automatic, or say "use context7" |
| playwright | MCP server | drives a real browser: click through pages, screenshots | ask, e.g. "open /projects and create a project" |
| pr-review-toolkit | agents and a skill | specialist reviews: tests, error handling, types, comments | `/pr-review-toolkit:review-pr`, or ask for a review |

Useful habits:

- **Run a skill by name**: type `/spec-propose add project archiving`. The spec
  skills only run when you call them; they never start on their own.
- **Ask for a plan first** on anything bigger than a small fix (shift+tab
  switches to plan mode). Review the plan, then let it work.
- **Check its claims.** Ask it to run `npm run spec:check` and `typecheck`,
  and read the diff before you commit.
- `/mcp` shows the MCP servers and whether they are connected; `/plugin`
  manages plugins; `/help` lists commands.
- Settings for you alone go in `.claude/settings.local.json`, not in
  `.claude/settings.json`, which everyone shares. Claude Code adds the local
  file to your global git ignore; check with `git check-ignore -v .claude/settings.local.json`.

### Codex

Start it in the repo folder: `codex`. It reads `AGENTS.md`, finds the spec
skills through `.agents/skills`, and gets the same context7 and playwright
servers from `.codex/config.toml` once you trust the project. To run a step,
name the skill: "use spec-propose for: add project archiving".

### Using both

Each tool can take any step, because the rules and skills are files in the
repo. Hand over through files: one tool writes `proposal.md`, you review it,
the other runs `/spec-design`. Avoid having both edit the same files at the same time.

## 6. When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| CI fails at "Install dependencies": `npm ci … not in sync` | lock written by a newer npm | `npx npm@10 install --package-lock-only`, commit |
| `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `x509: … unknown authority` | TLS-inspecting proxy | section 1, Zscaler |
| App exits at start with "configuration is invalid" | missing or bad env var | the message names each one; compare with `.env.example` |
| Every protected action is denied, or creating a project answers 503 | OPA off or unreachable, or no dev roles set | OPA fails closed by design; check `OPA_ENABLED` and `OPA_URL`, pick roles in the switcher |
| Project stays "provisioning" | worker not running, or Temporal unreachable | start the worker (section 3); its outbox sweeper starts pending workflows every 15 s |
| `ErrImageNeverPull` in the cluster | that image tag is not on the node | build that exact tag with `build-local.sh`, delete the pod |
| `spec:check` fails | an ID, scenario or task is missing or wrong | the message names the file and the requirement |
