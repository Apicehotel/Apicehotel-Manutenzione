-- Punto 10: Housekeeping consolidato.
-- Obiettivi: import idempotente per struttura/giorno, storico giornaliero,
-- versioni di ogni import, isolamento hotel e preservazione del lavoro gia svolto.

alter table public.import_camere
  add column if not exists work_date date not null default current_date,
  add column if not exists payload_hash text,
  add column if not exists status text not null default 'applied',
  add column if not exists n_created integer not null default 0,
  add column if not exists n_updated integer not null default 0,
  add column if not exists n_unchanged integer not null default 0;

alter table public.camere_lavoro
  add column if not exists work_date date not null default current_date;

create unique index if not exists import_camere_idempotent_idx
  on public.import_camere (hotel_id, work_date, payload_hash)
  where payload_hash is not null and status = 'applied';

create index if not exists import_camere_history_idx
  on public.import_camere (hotel_id, work_date desc, caricato_il desc);

create table if not exists public.housekeeping_daily_rooms (
  hotel_id text not null references public.hotels(id) on delete cascade,
  work_date date not null,
  camera text not null,
  struttura text not null,
  piano integer not null default 0,
  tipologia text,
  stato_slope text not null default 'libera',
  letti text,
  arrivo text,
  partenza text,
  import_id uuid references public.import_camere(id) on delete set null,
  aggiornato_il timestamptz not null default now(),
  primary key (hotel_id, work_date, camera),
  constraint housekeeping_daily_rooms_state_check
    check (stato_slope in ('b2b','partenza','arrivo','fermata','libera'))
);

comment on table public.housekeeping_daily_rooms is
  'Snapshot giornaliero anonimizzato delle camere Housekeeping, isolato per hotel e data.';

create index if not exists housekeeping_daily_rooms_lookup_idx
  on public.housekeeping_daily_rooms (hotel_id, work_date desc, struttura, piano, camera);

create table if not exists public.housekeeping_import_rooms (
  import_id uuid not null references public.import_camere(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  work_date date not null,
  camera text not null,
  struttura text not null,
  piano integer not null default 0,
  tipologia text,
  stato_slope text not null default 'libera',
  letti text,
  arrivo text,
  partenza text,
  created_at timestamptz not null default now(),
  primary key (import_id, camera),
  constraint housekeeping_import_rooms_state_check
    check (stato_slope in ('b2b','partenza','arrivo','fermata','libera'))
);

comment on table public.housekeeping_import_rooms is
  'Versione immutabile delle camere contenute in ciascun import Housekeeping.';

create index if not exists housekeeping_import_rooms_lookup_idx
  on public.housekeeping_import_rooms (hotel_id, work_date desc, camera);

alter table public.housekeeping_daily_rooms enable row level security;
alter table public.housekeeping_import_rooms enable row level security;

drop policy if exists housekeeping_daily_rooms_select on public.housekeeping_daily_rooms;
create policy housekeeping_daily_rooms_select on public.housekeeping_daily_rooms
for select to authenticated
using (public.has_app_permission(hotel_id, 'housekeeping', 'view'));

drop policy if exists housekeeping_import_rooms_select on public.housekeeping_import_rooms;
create policy housekeeping_import_rooms_select on public.housekeeping_import_rooms
for select to authenticated
using (public.has_app_permission(hotel_id, 'housekeeping', 'view'));

revoke insert, update, delete on public.housekeeping_daily_rooms from anon, authenticated;
revoke insert, update, delete on public.housekeeping_import_rooms from anon, authenticated;
grant select on public.housekeeping_daily_rooms to authenticated, service_role;
grant select on public.housekeeping_import_rooms to authenticated, service_role;

create or replace function public.carica_camere_giorno(
  p_hotel_id text,
  p_caricato_da text,
  p_camere jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_import_id uuid;
  v_existing_import uuid;
  v_n integer;
  v_b2b integer;
  v_payload_hash text;
  v_created integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  r jsonb;
  v_camera text;
  v_struttura text;
  v_piano integer;
  v_tipologia text;
  v_stato text;
  v_letti text;
  v_arrivo text;
  v_partenza text;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;

  if p_hotel_id is null or btrim(p_hotel_id) = '' then
    raise exception 'hotel_id mancante' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.hotel_memberships hm
    where hm.auth_user_id = v_uid
      and hm.hotel_id = p_hotel_id
      and hm.active = true
      and (hm.can_access_admin = true or hm.role in ('admin','Direzione','Reception'))
  ) then
    raise exception 'Non autorizzato a importare le camere per questa struttura'
      using errcode = '42501';
  end if;

  if p_camere is null or jsonb_typeof(p_camere) <> 'array' then
    raise exception 'Formato camere non valido' using errcode = '22023';
  end if;

  v_n := jsonb_array_length(p_camere);
  if v_n = 0 or v_n > 1000 then
    raise exception 'Numero camere non valido' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_camere) e
    where btrim(coalesce(e->>'camera','')) = ''
  ) then
    raise exception 'Camera mancante nel file' using errcode = '22023';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_camere)
  ) <> (
    select count(distinct btrim(e->>'camera')) from jsonb_array_elements(p_camere) e
  ) then
    raise exception 'Il file contiene camere duplicate' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_camere) e
    where coalesce(nullif(e->>'stato_slope',''),'libera')
      not in ('b2b','partenza','arrivo','fermata','libera')
  ) then
    raise exception 'Stato camera non valido nel file' using errcode = '22023';
  end if;

  select md5(coalesce(jsonb_agg(e order by btrim(e->>'camera'))::text, '[]'))
    into v_payload_hash
  from jsonb_array_elements(p_camere) e;

  select id into v_existing_import
  from public.import_camere
  where hotel_id = p_hotel_id
    and work_date = current_date
    and payload_hash = v_payload_hash
    and status = 'applied'
  order by caricato_il desc
  limit 1;

  -- Import identico nello stesso giorno: nessuna riscrittura e nessun reset del lavoro.
  if v_existing_import is not null then
    return v_existing_import;
  end if;

  select count(*) into v_b2b
  from jsonb_array_elements(p_camere) e
  where e->>'stato_slope' = 'b2b';

  -- Calcola il delta rispetto allo stato corrente prima di applicare l'import.
  select count(*) into v_created
  from jsonb_array_elements(p_camere) e
  where not exists (
    select 1 from public.camere_giorno cg
    where cg.hotel_id = p_hotel_id and cg.camera = btrim(e->>'camera')
  );

  select count(*) into v_unchanged
  from jsonb_array_elements(p_camere) e
  join public.camere_giorno cg
    on cg.hotel_id = p_hotel_id and cg.camera = btrim(e->>'camera')
  where coalesce(cg.struttura,'') = coalesce(nullif(e->>'struttura',''), nullif(e->>'gruppo',''), 'Generale')
    and coalesce(cg.tipologia,'') = coalesce(e->>'tipologia','')
    and coalesce(cg.stato_slope,'libera') = coalesce(nullif(e->>'stato_slope',''),'libera')
    and coalesce(cg.letti,'') = coalesce(e->>'letti','')
    and coalesce(cg.arrivo,'') = coalesce(e->>'arrivo','')
    and coalesce(cg.partenza,'') = coalesce(e->>'partenza','');

  v_updated := greatest(v_n - v_created - v_unchanged, 0);

  insert into public.import_camere(
    hotel_id, caricato_da, n_camere, n_b2b, work_date,
    payload_hash, status, n_created, n_updated, n_unchanged
  ) values (
    p_hotel_id, coalesce(nullif(btrim(p_caricato_da),''),'Utente'), v_n, v_b2b,
    current_date, v_payload_hash, 'applied', v_created, v_updated, v_unchanged
  ) returning id into v_import_id;

  for r in select * from jsonb_array_elements(p_camere)
  loop
    v_camera := btrim(r->>'camera');
    v_struttura := coalesce(nullif(r->>'struttura',''), nullif(r->>'gruppo',''), 'Generale');
    v_tipologia := nullif(btrim(coalesce(r->>'tipologia','')), '');
    v_stato := coalesce(nullif(r->>'stato_slope',''),'libera');
    v_letti := nullif(btrim(coalesce(r->>'letti','')), '');
    v_arrivo := nullif(btrim(coalesce(r->>'arrivo','')), '');
    v_partenza := nullif(btrim(coalesce(r->>'partenza','')), '');

    begin
      v_piano := nullif(r->>'piano','')::integer;
    exception when others then
      v_piano := null;
    end;
    if v_piano is null then
      begin
        v_piano := nullif(substring(v_struttura from '(?:^|[^0-9])([0-9]+)(?:[^0-9]|$)'),'')::integer;
      exception when others then
        v_piano := 0;
      end;
    end if;
    v_piano := coalesce(v_piano,0);

    insert into public.camere_giorno(
      hotel_id,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,import_id,aggiornato_il
    ) values (
      p_hotel_id,v_camera,v_struttura,v_piano,v_tipologia,v_stato,v_letti,v_arrivo,v_partenza,v_import_id,now()
    )
    on conflict (hotel_id,camera) do update set
      struttura = excluded.struttura,
      piano = excluded.piano,
      tipologia = excluded.tipologia,
      stato_slope = excluded.stato_slope,
      letti = excluded.letti,
      arrivo = excluded.arrivo,
      partenza = excluded.partenza,
      import_id = excluded.import_id,
      aggiornato_il = now();

    insert into public.camere_lavoro(hotel_id,camera,stato,work_date,aggiornato_il)
    values (
      p_hotel_id,v_camera,
      case when v_stato='libera' then 'fatto' else 'dafare' end,
      current_date,now()
    )
    on conflict (hotel_id,camera) do update set
      stato = case
        when public.camere_lavoro.work_date is distinct from current_date then excluded.stato
        else public.camere_lavoro.stato
      end,
      da_chi = case
        when public.camere_lavoro.work_date is distinct from current_date then null
        else public.camere_lavoro.da_chi
      end,
      work_date = current_date,
      aggiornato_il = case
        when public.camere_lavoro.work_date is distinct from current_date then now()
        else public.camere_lavoro.aggiornato_il
      end;

    insert into public.housekeeping_daily_rooms(
      hotel_id,work_date,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,import_id,aggiornato_il
    ) values (
      p_hotel_id,current_date,v_camera,v_struttura,v_piano,v_tipologia,v_stato,v_letti,v_arrivo,v_partenza,v_import_id,now()
    )
    on conflict (hotel_id,work_date,camera) do update set
      struttura=excluded.struttura,
      piano=excluded.piano,
      tipologia=excluded.tipologia,
      stato_slope=excluded.stato_slope,
      letti=excluded.letti,
      arrivo=excluded.arrivo,
      partenza=excluded.partenza,
      import_id=excluded.import_id,
      aggiornato_il=now();

    insert into public.housekeeping_import_rooms(
      import_id,hotel_id,work_date,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza
    ) values (
      v_import_id,p_hotel_id,current_date,v_camera,v_struttura,v_piano,v_tipologia,v_stato,v_letti,v_arrivo,v_partenza
    );
  end loop;

  update public.segnalazioni s
  set stato_camera = case cg.stato_slope
    when 'libera' then 'libera'
    when 'arrivo' then 'arrivo'
    when 'partenza' then 'fermata_cliente'
    when 'fermata' then 'fermata_cliente'
    when 'b2b' then 'fermata_cliente'
    else s.stato_camera
  end
  from public.camere_giorno cg
  where cg.camera = s.camera
    and cg.hotel_id = s.hotel_id
    and s.hotel_id = p_hotel_id
    and s.stato in ('todo','waiting','tecnico');

  return v_import_id;
end;
$function$;

revoke all on function public.carica_camere_giorno(text,text,jsonb) from public;
revoke execute on function public.carica_camere_giorno(text,text,jsonb) from anon;
grant execute on function public.carica_camere_giorno(text,text,jsonb) to authenticated, service_role;
