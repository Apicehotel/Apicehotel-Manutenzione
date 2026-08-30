create table if not exists public.randai_tasks (
  id text primary key,
  hotel_id text references public.hotels(id) on delete cascade,
  objective text not null,
  status text not null check (status in ('PENDING','RUNNING','PAUSED','BLOCKED','VERIFYING','SUCCEEDED','FAILED','CANCELLED')),
  plan jsonb not null,
  state jsonb not null,
  checkpoint jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists randai_tasks_hotel_status_idx on public.randai_tasks(hotel_id,status,updated_at desc);
create index if not exists randai_tasks_status_idx on public.randai_tasks(status,updated_at desc);

alter table public.randai_tasks enable row level security;

drop policy if exists randai_tasks_member_read on public.randai_tasks;
create policy randai_tasks_member_read on public.randai_tasks
for select to authenticated
using (hotel_id is not null and public.is_hotel_member(hotel_id));

drop policy if exists randai_tasks_admin_insert on public.randai_tasks;
create policy randai_tasks_admin_insert on public.randai_tasks
for insert to authenticated
with check (hotel_id is not null and public.can_admin_hotel(hotel_id));

drop policy if exists randai_tasks_admin_update on public.randai_tasks;
create policy randai_tasks_admin_update on public.randai_tasks
for update to authenticated
using (hotel_id is not null and public.can_admin_hotel(hotel_id))
with check (hotel_id is not null and public.can_admin_hotel(hotel_id));

drop policy if exists randai_tasks_admin_delete on public.randai_tasks;
create policy randai_tasks_admin_delete on public.randai_tasks
for delete to authenticated
using (hotel_id is not null and public.can_admin_hotel(hotel_id));
