create table if not exists public.randai_memory_items (
  id text primary key,
  type text not null check (type in ('working','conversational','episodic','semantic','procedural','project')),
  scope text not null check (scope in ('global','project','hotel','task')),
  trust text not null check (trust in ('draft','suggested','verified','approved','outdated')),
  hotel_id text references public.hotels(id) on delete cascade,
  project_id text,
  task_id text,
  content text not null,
  summary text,
  source_kind text not null,
  source_id text not null,
  source_uri text,
  importance double precision not null default 0.5 check (importance between 0 and 1),
  confidence double precision not null default 0.5 check (confidence between 0 and 1),
  entities jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint randai_memory_items_scope_shape check (
    (scope = 'hotel' and hotel_id is not null) or
    (scope = 'project' and project_id is not null) or
    (scope = 'task' and task_id is not null) or
    (scope = 'global')
  )
);

create index if not exists randai_memory_items_hotel_idx on public.randai_memory_items(hotel_id) where hotel_id is not null;
create index if not exists randai_memory_items_project_idx on public.randai_memory_items(project_id) where project_id is not null;
create index if not exists randai_memory_items_task_idx on public.randai_memory_items(task_id) where task_id is not null;
create index if not exists randai_memory_items_type_trust_idx on public.randai_memory_items(type, trust);
create index if not exists randai_memory_items_updated_idx on public.randai_memory_items(updated_at desc);

alter table public.randai_memory_items enable row level security;

drop policy if exists randai_memory_items_select on public.randai_memory_items;
create policy randai_memory_items_select on public.randai_memory_items
for select to authenticated using (
  (scope = 'hotel' and hotel_id is not null and (
    public.is_hotel_member(hotel_id) or public.can_manage_randai_hotel(hotel_id)
  )) or
  (scope in ('global','project','task') and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_memory_items_insert on public.randai_memory_items;
create policy randai_memory_items_insert on public.randai_memory_items
for insert to authenticated with check (
  (scope = 'hotel' and public.can_manage_randai_hotel(hotel_id)) or
  (scope in ('global','project','task') and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_memory_items_update on public.randai_memory_items;
create policy randai_memory_items_update on public.randai_memory_items
for update to authenticated using (
  (scope = 'hotel' and public.can_manage_randai_hotel(hotel_id)) or
  (scope in ('global','project','task') and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
) with check (
  (scope = 'hotel' and public.can_manage_randai_hotel(hotel_id)) or
  (scope in ('global','project','task') and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);

drop policy if exists randai_memory_items_delete on public.randai_memory_items;
create policy randai_memory_items_delete on public.randai_memory_items
for delete to authenticated using (
  (scope = 'hotel' and public.can_manage_randai_hotel(hotel_id)) or
  (scope in ('global','project','task') and exists (
    select 1 from public.hotels h
    where public.has_hotel_role(h.id, array['RandAI']::text[])
  ))
);
