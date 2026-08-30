create table if not exists public.randai_eval_runs (
  id text primary key,
  suite_id text not null,
  scenario_id text not null,
  status text not null check (status in ('PENDING','RUNNING','PASSED','FAILED','ERROR')),
  score double precision not null default 0 check (score >= 0 and score <= 1),
  passed boolean not null default false,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists randai_eval_runs_suite_created_idx on public.randai_eval_runs(suite_id, created_at desc);
create index if not exists randai_eval_runs_status_created_idx on public.randai_eval_runs(status, created_at desc);

alter table public.randai_eval_runs enable row level security;

create policy randai_eval_runs_select on public.randai_eval_runs
for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);

create policy randai_eval_runs_insert on public.randai_eval_runs
for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);

create policy randai_eval_runs_update on public.randai_eval_runs
for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);

create policy randai_eval_runs_delete on public.randai_eval_runs
for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
