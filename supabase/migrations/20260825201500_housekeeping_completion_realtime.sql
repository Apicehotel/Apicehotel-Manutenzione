-- Housekeeping: il consuntivo deriva dallo stato reale di camere_lavoro.
-- Questo evita doppi conteggi e mantiene il dato corretto anche dopo sync offline.

create or replace function public.sync_housekeeping_completion_from_work()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(new.updated_by_user_id, auth.uid());
  v_role text;
  v_day public.camere_giorno;
begin
  if new.stato <> 'fatto' then
    delete from public.housekeeping_completions
    where hotel_id = new.hotel_id
      and work_date = current_date
      and camera = new.camera;
    return new;
  end if;

  select hm.role into v_role
  from public.hotel_memberships hm
  where hm.hotel_id = new.hotel_id
    and hm.auth_user_id = v_uid
    and coalesce(hm.active, true)
  limit 1;

  -- Reception/Direzione possono correggere lo stato, ma il consuntivo personale
  -- viene attribuito solo a Governante o Capo Governante.
  if v_role not in ('Governante', 'Capo Governante') then
    return new;
  end if;

  select * into v_day
  from public.camere_giorno cg
  where cg.hotel_id = new.hotel_id and cg.camera = new.camera
  limit 1;

  insert into public.housekeeping_completions(
    hotel_id, work_date, camera, room_type, section, floor,
    housekeeper_user_id, housekeeper_name_snapshot, completed_at, updated_at
  ) values (
    new.hotel_id,
    current_date,
    new.camera,
    coalesce(nullif(trim(v_day.tipologia), ''), 'Standard'),
    nullif(trim(v_day.struttura), ''),
    v_day.piano,
    v_uid,
    coalesce(nullif(trim(new.da_chi), ''), 'Governante'),
    coalesce(new.aggiornato_il, now()),
    now()
  )
  on conflict (hotel_id, work_date, camera) do update set
    room_type = excluded.room_type,
    section = excluded.section,
    floor = excluded.floor,
    housekeeper_user_id = excluded.housekeeper_user_id,
    housekeeper_name_snapshot = excluded.housekeeper_name_snapshot,
    completed_at = excluded.completed_at,
    updated_at = now();

  return new;
end;
$$;

revoke execute on function public.sync_housekeeping_completion_from_work() from public, anon, authenticated;
grant execute on function public.sync_housekeeping_completion_from_work() to service_role;

drop trigger if exists trg_sync_housekeeping_completion_from_work on public.camere_lavoro;
create trigger trg_sync_housekeeping_completion_from_work
after insert or update of stato, da_chi, aggiornato_il, updated_by_user_id
on public.camere_lavoro
for each row execute function public.sync_housekeeping_completion_from_work();

-- La Reception usa Postgres Changes per il popup in-app.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'housekeeping_completions'
  ) then
    alter publication supabase_realtime add table public.housekeeping_completions;
  end if;
end $$;
