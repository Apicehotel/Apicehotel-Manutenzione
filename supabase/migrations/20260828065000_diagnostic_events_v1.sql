create table if not exists public.diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  auth_user_id uuid not null default auth.uid(),
  severity text not null default 'error' check (severity in ('info','warning','error','fatal')),
  kind text not null,
  message text not null,
  detail text,
  app_build text,
  route text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists diagnostic_events_hotel_created_idx on public.diagnostic_events (hotel_id, created_at desc);
create index if not exists diagnostic_events_user_created_idx on public.diagnostic_events (auth_user_id, created_at desc);

alter table public.diagnostic_events enable row level security;

revoke all on public.diagnostic_events from anon;
grant insert, select, delete on public.diagnostic_events to authenticated;

drop policy if exists diagnostic_events_insert_member on public.diagnostic_events;
create policy diagnostic_events_insert_member on public.diagnostic_events
for insert to authenticated
with check (auth_user_id = auth.uid() and public.is_hotel_member(hotel_id));

drop policy if exists diagnostic_events_select_admin on public.diagnostic_events;
create policy diagnostic_events_select_admin on public.diagnostic_events
for select to authenticated
using (public.can_admin_hotel(hotel_id));

drop policy if exists diagnostic_events_delete_admin on public.diagnostic_events;
create policy diagnostic_events_delete_admin on public.diagnostic_events
for delete to authenticated
using (public.can_admin_hotel(hotel_id));
