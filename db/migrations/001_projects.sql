-- Projects, their members, and the outbox that starts provisioning workflows.
-- Plain SQL until a migration tool is chosen (see README, "Database").
--
-- Layering: these constraints only guard data integrity (shape, uniqueness,
-- valid states). Business policy, such as "sensitive projects need an ethics
-- approval", lives in OPA (dashr-nova-policies), not here.

create table projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) between 3 and 120),
  description         text,
  data_classification text not null check (data_classification in ('public', 'internal', 'sensitive')),
  ethics_approval_id  text,
  owner_id            text not null,
  status              text not null default 'pending'
                      check (status in ('pending', 'provisioning', 'active', 'partially_provisioned', 'failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- Case-insensitive uniqueness; the app's pre-check only produces a friendlier error.
create unique index projects_name_key on projects (lower(name));

create table project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id    text not null,
  role       text not null check (role in ('lead', 'member')),
  -- pending: not checked yet; blocked: waiting on the user (reasons say why);
  -- expired: still blocked at the deadline; failed: provisioning failed permanently
  status     text not null default 'pending'
             check (status in ('pending', 'blocked', 'active', 'failed', 'expired')),
  reasons    text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Facts the membership policy decides on. The policy (not the app) knows
-- which terms version is current.
create table user_terms_acceptances (
  user_id       text not null,
  terms_version text not null,
  accepted_at   timestamptz not null default now(),
  primary key (user_id, terms_version)
);

-- Transactional outbox: written in the same transaction as the project, so a
-- crash between commit and starting the workflow loses nothing. The worker's
-- sweeper starts anything the API did not.
create table outbox (
  id            bigserial primary key,
  kind          text not null,
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts      int not null default 0,
  last_error    text
);
create index outbox_pending on outbox (created_at) where dispatched_at is null;
