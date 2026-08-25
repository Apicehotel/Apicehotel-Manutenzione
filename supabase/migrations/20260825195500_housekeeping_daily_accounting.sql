-- Housekeeping v2: storico giornaliero, ruolo Capo Governante, audit e ntfy.
-- Privacy by design: nessun dato ospite viene archiviato in queste tabelle.

alter table public.hotel_memberships drop constraint if exists hotel_memberships_role_check;
alter table public.hotel_memberships add constraint hotel_memberships_role_check check (role = any (array[
  'admin'::text,
  'Supremo'::text,
  'Direzione'::text,
  'Direttore Centro Congressi'::text,
  'Portiere Notturno'::text,
  'manutentore'::text,
  'Tecnico esterno'::text,
  'Governante'::text,
  'Capo Governante'::text,
  'Reception'::text,
  'Isola dei Golosi'::text,
  'Ristorante Wine/Jazz'::text,
  'Colazione Jazz'::text
]));

create table if not exists public.housekeeping_completions (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  work_date date not null default current_date,
  camera text not null,
  room_type text not null default 'Standard',
  section text,
  floor integer,
  housekeeper_user_id uuid references public.profiles(auth_user_id) on delete set null,
  housekeeper_name_snapshot text not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, work_date, camera)
);

comment on table public.housekeeping_completions is 'Consuntivo operativo Housekeeping anonimizzato. Una camera conta al massimo una volta per hotel e data.';
comment on column public.housekeeping_completions.housekeeper_name_snapshot is 'Nome operativo della governante al momento del completamento; nessun dato ospite.';

create index if not exists housekeeping_completions_month_idx
  on public.housekeeping_completions (hotel_id, work_date, housekeeper_user_id);
create index if not exists housekeeping_completions_type_idx
  on public.housekeeping_completions (hotel_id, work_date, room_type);

create table if not exists public.housekeeping_change_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  work_date date not null default current_date,
  camera text not null,
  changed_by_user_id uuid references public.profiles(auth_user_id) on delete set null,
  changed_by_name text not null,
  changed_by_role text not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now()
);

comment on table public.housekeeping_change_events is 'Audit delle sole modifiche operative Housekeeping; vietato inserire dati ospite.';
create index if not exists housekeeping_change_events_lookup_idx
  on public.housekeeping_change_events (hotel_id, work_date, camera, changed_at desc);

alter table public.housekeeping_completions enable row level security;
alter table public.housekeeping_change_events enable row level security;

drop policy if exists housekeeping_completions_read on public.housekeeping_completions;
create policy housekeeping_completions_read on public.housekeeping_completions
for select to authenticated using (public.is_hotel_member(hotel_id));

drop policy if exists housekeeping_completions_write on public.housekeeping_completions;
create policy housekeeping_completions_write on public.housekeeping_completions
for all to authenticated
using (public.has_hotel_role(hotel_id, array['admin','Direzione','Reception','Governante','Capo Governante']))
with check (public.has_hotel_role(hotel_id, array['admin','Direzione','Reception','Governante','Capo Governante']));

drop policy if exists housekeeping_changes_read on public.housekeeping_change_events;
create policy housekeeping_changes_read on public.housekeeping_change_events
for select to authenticated using (public.is_hotel_member(hotel_id));

drop policy if exists housekeeping_changes_insert on public.housekeeping_change_events;
create policy housekeeping_changes_insert on public.housekeeping_change_events
for insert to authenticated
with check (public.has_hotel_role(hotel_id, array['admin','Direzione','Reception']));

create or replace function public.upsert_housekeeping_completion(
  p_hotel_id text,
  p_camera text,
  p_room_type text,
  p_section text,
  p_floor integer,
  p_housekeeper_name text
) returns public.housekeeping_completions
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.housekeeping_completions;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if not public.has_hotel_role(p_hotel_id, array['admin','Direzione','Reception','Governante','Capo Governante']) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;

  insert into public.housekeeping_completions(
    hotel_id, work_date, camera, room_type, section, floor,
    housekeeper_user_id, housekeeper_name_snapshot, completed_at, updated_at
  ) values (
    p_hotel_id, current_date, p_camera, coalesce(nullif(trim(p_room_type),''),'Standard'),
    nullif(trim(p_section),''), p_floor, v_uid, coalesce(nullif(trim(p_housekeeper_name),''),'Governante'), now(), now()
  )
  on conflict (hotel_id, work_date, camera) do update set
    room_type = excluded.room_type,
    section = excluded.section,
    floor = excluded.floor,
    housekeeper_user_id = excluded.housekeeper_user_id,
    housekeeper_name_snapshot = excluded.housekeeper_name_snapshot,
    completed_at = excluded.completed_at,
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.clear_housekeeping_completion(p_hotel_id text, p_camera text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if not public.has_hotel_role(p_hotel_id, array['admin','Direzione','Reception','Governante','Capo Governante']) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;
  delete from public.housekeeping_completions
   where hotel_id=p_hotel_id and work_date=current_date and camera=p_camera;
end;
$$;

create or replace function public.dispatch_housekeeping_ntfy()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  cfg jsonb;
  enabled_flag boolean;
  topic text;
  server text;
  hotel_name text;
  msg text;
begin
  if new.changed_by_role not in ('Direzione','Reception') then return new; end if;
  select enabled, config into enabled_flag, cfg
    from public.integration_settings where key='housekeeping_ntfy';
  if coalesce(enabled_flag,false) is not true then return new; end if;
  topic := coalesce(cfg->'topics'->>new.hotel_id,'');
  if topic='' then return new; end if;
  server := rtrim(coalesce(cfg->>'server','https://ntfy.sh'),'/');
  select name into hotel_name from public.hotels where id=new.hotel_id;
  msg := format('Camera %s · %s modificato da %s', new.camera, new.field_name, new.changed_by_name);
  perform net.http_post(
    url := server,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'topic', topic,
      'title', 'Housekeeping · ' || coalesce(hotel_name,new.hotel_id),
      'message', msg,
      'priority', 4,
      'tags', jsonb_build_array('house','memo'),
      'click', 'https://apicehotel.vercel.app/?section=housekeeping&hotel_id=' || new.hotel_id || '&camera=' || new.camera
    ),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_dispatch_housekeeping_ntfy on public.housekeeping_change_events;
create trigger trg_dispatch_housekeeping_ntfy
after insert on public.housekeeping_change_events
for each row execute function public.dispatch_housekeeping_ntfy();

revoke execute on function public.upsert_housekeeping_completion(text,text,text,text,integer,text) from public, anon;
revoke execute on function public.clear_housekeeping_completion(text,text) from public, anon;
revoke execute on function public.dispatch_housekeeping_ntfy() from public, anon, authenticated;
grant execute on function public.upsert_housekeeping_completion(text,text,text,text,integer,text) to authenticated, service_role;
grant execute on function public.clear_housekeeping_completion(text,text) to authenticated, service_role;
grant execute on function public.dispatch_housekeeping_ntfy() to service_role;
