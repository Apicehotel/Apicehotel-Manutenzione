create table if not exists public.randai_sensor_bindings (
  device_id text primary key references public.sensori_temperatura(device_id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  equipment_id text null references public.randai_equipment(id) on delete set null,
  zone text not null,
  signal_type text not null default 'technical_temperature',
  unit text not null default '°C',
  scope text not null default 'local' check (scope in ('local','shared_system','whole_area')),
  semantic_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists randai_sensor_bindings_hotel_zone_idx on public.randai_sensor_bindings(hotel_id, zone);
alter table public.randai_sensor_bindings enable row level security;

drop policy if exists randai_sensor_bindings_member_read on public.randai_sensor_bindings;
create policy randai_sensor_bindings_member_read on public.randai_sensor_bindings for select to authenticated using (active and public.is_hotel_member(hotel_id));

drop policy if exists randai_sensor_bindings_admin_all on public.randai_sensor_bindings;
create policy randai_sensor_bindings_admin_all on public.randai_sensor_bindings for all to authenticated using (public.can_admin_hotel(hotel_id)) with check (public.can_admin_hotel(hotel_id));

insert into public.randai_equipment(id, hotel_id, name, category, location, description, active)
values ('hotelgio-wine-ac-rooftop-group','hotelgio','Gruppo climatizzazione Wine - tetto 1/2/3','climatizzazione','Tetto Wine','Configurazione provvisoria: i tre circuiti/sonde sul tetto sono riferiti all’intera area Wine.',true)
on conflict (id) do update set name=excluded.name, category=excluded.category, location=excluded.location, description=excluded.description, active=true, updated_at=now();

insert into public.randai_equipment_serves(equipment_id, served_area, note) values
('hotelgio-wine-ac-rooftop-group','Tutto Wine','Configurazione provvisoria confermata: tetto 1, 2 e 3 riguardano tutto il Wine.'),
('hotelgio-wine-ac-rooftop-group','1° Wine','Servito dal gruppo Wine sul tetto.'),
('hotelgio-wine-ac-rooftop-group','2° Wine','Servito dal gruppo Wine sul tetto.'),
('hotelgio-wine-ac-rooftop-group','3° Wine','Servito dal gruppo Wine sul tetto.')
on conflict (equipment_id, served_area) do update set note=excluded.note;

insert into public.randai_sensor_bindings(device_id,hotel_id,equipment_id,zone,signal_type,unit,scope,semantic_label) values
('1001e22b8d','hotelgio','hotelgio-wine-ac-rooftop-group','Wine','technical_temperature','°C','whole_area','Circuito/sonda tecnica Wine tetto 1'),
('10025339c4','hotelgio','hotelgio-wine-ac-rooftop-group','Wine','technical_temperature','°C','whole_area','Circuito/sonda tecnica Wine tetto 2'),
('1001e22ba7','hotelgio','hotelgio-wine-ac-rooftop-group','Wine','technical_temperature','°C','whole_area','Circuito/sonda tecnica Wine tetto 3'),
('1002534102','hotelgio','hotelgio-jazz-ac-outdoor-01','1° Jazz','technical_temperature','°C','shared_system','Circuito/sonda tecnica climatizzazione Jazz P1'),
('10025340a7','hotelgio','hotelgio-jazz-ac-outdoor-01','2° Jazz','technical_temperature','°C','shared_system','Circuito/sonda tecnica climatizzazione Jazz P2'),
('10023c8674','hotelgio','hotelgio-jazz-ac-outdoor-01','3° Jazz','technical_temperature','°C','shared_system','Circuito/sonda tecnica climatizzazione Jazz P3'),
('1002534089','hotelgio','hotelgio-jazz-ac-outdoor-01','4° Jazz','technical_temperature','°C','shared_system','Circuito/sonda tecnica climatizzazione Jazz P4')
on conflict (device_id) do update set hotel_id=excluded.hotel_id,equipment_id=excluded.equipment_id,zone=excluded.zone,signal_type=excluded.signal_type,unit=excluded.unit,scope=excluded.scope,semantic_label=excluded.semantic_label,active=true,updated_at=now();

create or replace function public.randai_sensor_context(p_hotel_id text, p_query text)
returns table(device_id text, semantic_label text, zone text, signal_type text, unit text, scope text, temperature numeric, humidity text, online boolean, alert boolean, updated_at timestamptz, stale boolean)
language sql
security definer
set search_path = public
stable
as $$
  with q as (select lower(coalesce(p_query,'')) txt)
  select b.device_id,b.semantic_label,b.zone,b.signal_type,b.unit,b.scope,s.temperatura,s.umidita,s.online,s.in_allerta,s.aggiornato_il,
         (s.aggiornato_il < now() - interval '15 minutes') as stale
  from public.randai_sensor_bindings b
  join public.sensori_temperatura s on s.device_id=b.device_id
  cross join q
  where b.hotel_id=p_hotel_id and b.active
    and (
      (q.txt like '%wine%' and b.zone='Wine')
      or (q.txt like '%jazz%' and b.zone ilike '%Jazz%')
      or q.txt like '%condizion%'
      or q.txt like '%clima%'
      or q.txt like '%fredd%'
      or q.txt like '%temperatur%'
    )
  order by b.zone,b.semantic_label;
$$;
revoke all on function public.randai_sensor_context(text,text) from public, anon, authenticated;
grant execute on function public.randai_sensor_context(text,text) to service_role;