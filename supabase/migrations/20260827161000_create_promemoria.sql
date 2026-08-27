create table if not exists public.promemoria (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  message text not null,
  photo_url text,
  target_roles text[] not null default '{}',
  repeat_kind text not null default 'once' check (repeat_kind in ('once','daily','weekly','monthly')),
  weekdays text[] not null default '{}',
  month_day int,
  times text[] not null default '{}',
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_by_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.promemoria_invio (
  id bigserial primary key,
  promemoria_id uuid references public.promemoria(id) on delete cascade,
  hotel_id text not null,
  dedupe_key text unique not null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text not null,
  error text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.promemoria enable row level security;
alter table public.promemoria_invio enable row level security;
drop policy if exists promemoria_select_members on public.promemoria;
drop policy if exists promemoria_insert_senders on public.promemoria;
drop policy if exists promemoria_update_senders on public.promemoria;
drop policy if exists promemoria_delete_senders on public.promemoria;
drop policy if exists promemoria_invio_select_members on public.promemoria_invio;
create policy promemoria_select_members on public.promemoria for select to authenticated using (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria.hotel_id and hm.active));
create policy promemoria_insert_senders on public.promemoria for insert to authenticated with check (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria.hotel_id and hm.active and hm.role in ('admin','Supremo','Direzione','Direttore Centro Congressi','Reception')));
create policy promemoria_update_senders on public.promemoria for update to authenticated using (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria.hotel_id and hm.active and hm.role in ('admin','Supremo','Direzione','Direttore Centro Congressi','Reception'))) with check (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria.hotel_id and hm.active and hm.role in ('admin','Supremo','Direzione','Direttore Centro Congressi','Reception')));
create policy promemoria_delete_senders on public.promemoria for delete to authenticated using (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria.hotel_id and hm.active and hm.role in ('admin','Supremo','Direzione','Direttore Centro Congressi','Reception')));
create policy promemoria_invio_select_members on public.promemoria_invio for select to authenticated using (exists(select 1 from public.hotel_memberships hm where hm.auth_user_id=auth.uid() and hm.hotel_id=promemoria_invio.hotel_id and hm.active));
