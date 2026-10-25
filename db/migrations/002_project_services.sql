-- Which services each project asked for, and how provisioning went for each.
-- Written by the orchestrator workflow (activities), read by the web pages.

create table project_services (
  project_id   uuid not null references projects (id) on delete cascade,
  service      text not null,
  -- skipped: a service it depends on failed
  status       text not null default 'pending'
               check (status in ('pending', 'provisioning', 'active', 'failed', 'skipped')),
  resource_ref text,          -- the service's own ID, from its provisioner
  error        text,
  updated_at   timestamptz not null default now(),
  primary key (project_id, service)
);

-- Access groups are a project-level step that runs before any service.
alter table projects add column entitlements_status text not null default 'pending'
  check (entitlements_status in ('pending', 'provisioning', 'active', 'failed'));
