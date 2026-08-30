create table if not exists public.randai_knowledge_gaps (
  id text primary key,
  scope text not null check (scope in ('maintenance','project','code','procedure','documentation','decision')),
  status text not null check (status in ('open','proposed','resolved','dismissed')),
  priority text not null check (priority in ('low','normal','high','critical')),
  hotel_id text references public.hotels(id) on delete cascade,
  project_id text,
  task_id text,
  question text not null,
  context text,
  entity_type text,
  entity_id text,
  proposed_answer text,
  source_kind text,
  source_id text,
  resolution_source_kind text,
  resolution_source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint randai_knowledge_gaps_maintenance_scope check (scope <> 'maintenance' or hotel_id is not null)
);

create index if not exists randai_knowledge_gaps_hotel_status_idx on public.randai_knowledge_gaps(hotel_id, status) where hotel_id is not null;
create index if not exists randai_knowledge_gaps_scope_status_idx on public.randai_knowledge_gaps(scope, status);
create index if not exists randai_knowledge_gaps_project_idx on public.randai_knowledge_gaps(project_id) where project_id is not null;
create index if not exists randai_knowledge_gaps_task_idx on public.randai_knowledge_gaps(task_id) where task_id is not null;

alter table public.randai_knowledge_gaps enable row level security;

drop policy if exists randai_knowledge_gaps_select on public.randai_knowledge_gaps;
create policy randai_knowledge_gaps_select on public.randai_knowledge_gaps
for select to authenticated using (
  (scope = 'maintenance' and hotel_id is not null and (
    public.is_hotel_member(hotel_id) or public.can_manage_randai_hotel(hotel_id)
  )) or
  (scope <> 'maintenance' and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_knowledge_gaps_insert on public.randai_knowledge_gaps;
create policy randai_knowledge_gaps_insert on public.randai_knowledge_gaps
for insert to authenticated with check (
  (scope = 'maintenance' and public.can_manage_randai_hotel(hotel_id)) or
  (scope <> 'maintenance' and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_knowledge_gaps_update on public.randai_knowledge_gaps;
create policy randai_knowledge_gaps_update on public.randai_knowledge_gaps
for update to authenticated using (
  (scope = 'maintenance' and public.can_manage_randai_hotel(hotel_id)) or
  (scope <> 'maintenance' and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
) with check (
  (scope = 'maintenance' and public.can_manage_randai_hotel(hotel_id)) or
  (scope <> 'maintenance' and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_knowledge_gaps_delete on public.randai_knowledge_gaps;
create policy randai_knowledge_gaps_delete on public.randai_knowledge_gaps
for delete to authenticated using (
  (scope = 'maintenance' and public.can_manage_randai_hotel(hotel_id)) or
  (scope <> 'maintenance' and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);
