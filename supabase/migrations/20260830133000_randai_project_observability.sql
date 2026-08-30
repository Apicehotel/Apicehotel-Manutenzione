create table if not exists public.randai_project_graphs (
  project_id text primary key,
  graph jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.randai_observability_traces (
  id text primary key,
  project_id text,
  task_id text,
  name text not null,
  status text not null check (status in ('RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  trace jsonb not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists randai_observability_traces_project_started_idx on public.randai_observability_traces(project_id, started_at desc);
create index if not exists randai_observability_traces_task_idx on public.randai_observability_traces(task_id, started_at desc);
create index if not exists randai_observability_traces_status_idx on public.randai_observability_traces(status, started_at desc);

alter table public.randai_project_graphs enable row level security;
alter table public.randai_observability_traces enable row level security;

create policy randai_project_graphs_select on public.randai_project_graphs for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_project_graphs_insert on public.randai_project_graphs for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_project_graphs_update on public.randai_project_graphs for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_project_graphs_delete on public.randai_project_graphs for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);

create policy randai_observability_traces_select on public.randai_observability_traces for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_observability_traces_insert on public.randai_observability_traces for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_observability_traces_update on public.randai_observability_traces for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_observability_traces_delete on public.randai_observability_traces for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
