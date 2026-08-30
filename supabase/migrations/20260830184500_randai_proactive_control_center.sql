create table if not exists public.randai_proactive_signals (
  id text primary key,
  project_id text not null default 'randai',
  type text not null,
  fingerprint text not null,
  severity text not null check (severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  status text not null check (status in ('OPEN','SUPPRESSED','PROPOSED','ACTIONED','BLOCKED','RESOLVED')),
  count integer not null default 1 check (count > 0),
  signal jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists randai_proactive_project_status_idx on public.randai_proactive_signals(project_id,status,updated_at desc);
create index if not exists randai_proactive_fingerprint_idx on public.randai_proactive_signals(project_id,fingerprint,updated_at desc);
alter table public.randai_proactive_signals enable row level security;
create policy randai_proactive_select on public.randai_proactive_signals for select to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI']::text[])));
create policy randai_proactive_insert on public.randai_proactive_signals for insert to authenticated with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI']::text[])));
create policy randai_proactive_update on public.randai_proactive_signals for update to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI']::text[]))) with check (exists (select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI']::text[])));
create policy randai_proactive_delete on public.randai_proactive_signals for delete to authenticated using (exists (select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI']::text[])));
