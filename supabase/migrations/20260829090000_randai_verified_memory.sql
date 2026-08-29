create table if not exists public.randai_memory (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  equipment_id text references public.randai_equipment(id) on delete set null,
  source_issue_id uuid null,
  source_intervention_id uuid null,
  area text,
  category text,
  symptom text not null,
  error_code text,
  cause text,
  solution text not null,
  outcome text not null default 'resolved' check (outcome in ('resolved','partial','failed')),
  confidence text not null default 'confirmed' check (confidence in ('confirmed','probable')),
  confirmation_count integer not null default 1 check (confirmation_count >= 1),
  failure_count integer not null default 0 check (failure_count >= 0),
  source_label text not null default 'Esperienza RandApp confermata',
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint randai_memory_source_present check (source_issue_id is not null or source_intervention_id is not null)
);

create index if not exists randai_memory_hotel_idx on public.randai_memory(hotel_id, updated_at desc);
create index if not exists randai_memory_lookup_idx on public.randai_memory(hotel_id, category, area);
create index if not exists randai_memory_text_idx on public.randai_memory using gin (to_tsvector('simple', coalesce(symptom,'') || ' ' || coalesce(error_code,'') || ' ' || coalesce(cause,'') || ' ' || coalesce(solution,'')));

alter table public.randai_memory enable row level security;

drop policy if exists randai_memory_member_read on public.randai_memory;
create policy randai_memory_member_read on public.randai_memory for select to authenticated using (public.is_hotel_member(hotel_id));

drop policy if exists randai_memory_admin_manage on public.randai_memory;
create policy randai_memory_admin_manage on public.randai_memory for all to authenticated using (public.can_admin_hotel(hotel_id)) with check (public.can_admin_hotel(hotel_id));

create or replace function public.randai_search_memory(p_hotel_id text, p_query text, p_limit integer default 5)
returns setof public.randai_memory
language sql
security definer
set search_path = public
stable
as $$
  select m.*
  from public.randai_memory m
  where m.hotel_id = p_hotel_id
    and m.outcome = 'resolved'
    and to_tsvector('simple', coalesce(m.symptom,'') || ' ' || coalesce(m.error_code,'') || ' ' || coalesce(m.cause,'') || ' ' || coalesce(m.solution,'')) @@ websearch_to_tsquery('simple', p_query)
  order by m.confirmation_count desc, m.failure_count asc, m.last_confirmed_at desc
  limit least(greatest(coalesce(p_limit,5),1),10);
$$;
revoke all on function public.randai_search_memory(text,text,integer) from public, anon, authenticated;
grant execute on function public.randai_search_memory(text,text,integer) to service_role;
