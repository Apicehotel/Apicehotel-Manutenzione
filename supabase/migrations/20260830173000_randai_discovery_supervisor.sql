create table if not exists public.randai_discovery_candidates (
  id text primary key,
  project_id text not null default 'randai',
  kind text not null check (kind in ('SKILL','TOOL','MCP','LIBRARY')),
  status text not null check (status in ('DISCOVERED','ANALYZED','SANDBOXED','EVALUATED','RECOMMENDED','REJECTED')),
  source_id text not null,
  source_ref text not null,
  risk text not null check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  score double precision not null default 0 check (score >= 0 and score <= 1),
  candidate jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists randai_discovery_project_status_idx on public.randai_discovery_candidates(project_id, status, updated_at desc);
create index if not exists randai_discovery_source_idx on public.randai_discovery_candidates(source_id, updated_at desc);

create table if not exists public.randai_supervisor_runs (
  id text primary key,
  project_id text not null default 'randai',
  task_id text,
  status text not null check (status in ('PLANNED','RUNNING','NEEDS_REVIEW','BLOCKED','SUCCEEDED','FAILED','STOPPED')),
  mode text not null check (mode in ('SINGLE_AGENT','MULTI_AGENT','DISCOVERY_REQUIRED','STOPPED')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists randai_supervisor_project_status_idx on public.randai_supervisor_runs(project_id, status, updated_at desc);
create index if not exists randai_supervisor_task_idx on public.randai_supervisor_runs(task_id) where task_id is not null;

alter table public.randai_discovery_candidates enable row level security;
alter table public.randai_supervisor_runs enable row level security;

create policy randai_discovery_select on public.randai_discovery_candidates for select to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_discovery_insert on public.randai_discovery_candidates for insert to authenticated with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_discovery_update on public.randai_discovery_candidates for update to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))) with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_discovery_delete on public.randai_discovery_candidates for delete to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));

create policy randai_supervisor_select on public.randai_supervisor_runs for select to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_supervisor_insert on public.randai_supervisor_runs for insert to authenticated with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_supervisor_update on public.randai_supervisor_runs for update to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))) with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
create policy randai_supervisor_delete on public.randai_supervisor_runs for delete to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[])));
