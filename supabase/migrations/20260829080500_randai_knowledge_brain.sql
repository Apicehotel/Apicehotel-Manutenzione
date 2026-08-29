create table if not exists public.randai_procedures (
  id text primary key,
  hotel_id text not null references public.hotels(id) on delete cascade,
  title text not null,
  category text not null,
  area text,
  symptom text,
  summary text not null,
  keywords text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  caution text,
  source_label text not null,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  version integer not null default 1 check (version > 0),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.randai_equipment (
  id text primary key,
  hotel_id text not null references public.hotels(id) on delete cascade,
  name text not null,
  category text not null,
  location text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.randai_equipment_serves (
  equipment_id text not null references public.randai_equipment(id) on delete cascade,
  served_area text not null,
  note text,
  primary key (equipment_id, served_area)
);

create index if not exists randai_procedures_hotel_status_idx on public.randai_procedures(hotel_id,status);
create index if not exists randai_equipment_hotel_category_idx on public.randai_equipment(hotel_id,category) where active;

alter table public.randai_procedures enable row level security;
alter table public.randai_equipment enable row level security;
alter table public.randai_equipment_serves enable row level security;

drop policy if exists randai_procedures_member_read on public.randai_procedures;
create policy randai_procedures_member_read on public.randai_procedures for select to authenticated
using (status = 'approved' and public.is_hotel_member(hotel_id));

drop policy if exists randai_procedures_admin_all on public.randai_procedures;
create policy randai_procedures_admin_all on public.randai_procedures for all to authenticated
using (public.can_admin_hotel(hotel_id)) with check (public.can_admin_hotel(hotel_id));

drop policy if exists randai_equipment_member_read on public.randai_equipment;
create policy randai_equipment_member_read on public.randai_equipment for select to authenticated
using (active and public.is_hotel_member(hotel_id));

drop policy if exists randai_equipment_admin_all on public.randai_equipment;
create policy randai_equipment_admin_all on public.randai_equipment for all to authenticated
using (public.can_admin_hotel(hotel_id)) with check (public.can_admin_hotel(hotel_id));

drop policy if exists randai_equipment_serves_member_read on public.randai_equipment_serves;
create policy randai_equipment_serves_member_read on public.randai_equipment_serves for select to authenticated
using (exists (select 1 from public.randai_equipment e where e.id = equipment_id and e.active and public.is_hotel_member(e.hotel_id)));

drop policy if exists randai_equipment_serves_admin_all on public.randai_equipment_serves;
create policy randai_equipment_serves_admin_all on public.randai_equipment_serves for all to authenticated
using (exists (select 1 from public.randai_equipment e where e.id = equipment_id and public.can_admin_hotel(e.hotel_id)))
with check (exists (select 1 from public.randai_equipment e where e.id = equipment_id and public.can_admin_hotel(e.hotel_id)));

insert into public.randai_procedures(id,hotel_id,title,category,area,symptom,summary,keywords,steps,caution,source_label,status,version,approved_at)
values (
  'hotelgio-jazz-clima-not-cooling','hotelgio','Jazz - aria condizionata non raffredda','climatizzazione','Jazz','non raffredda',
  'Prima verificare la temperatura della zona. Se è anomala, controllare il motore esterno al 1° Jazz che gestisce l’aria condizionata dei quattro piani Jazz.',
  array['condizionatore','condizionatori','clima','aria condizionata','fredda','freddano','raffredda','raffreddano','jazz','temperatura'],
  '["Controlla la temperatura rilevata nella zona interessata del Jazz.","Se la temperatura è anomala, verifica se il problema riguarda anche altri piani Jazz.","Controlla il motore esterno situato al 1° Jazz.","Ricorda che questo motore gestisce l’aria condizionata dei quattro piani Jazz: un’anomalia qui può coinvolgere più piani.","Annota temperatura, piani coinvolti e stato del motore prima di proseguire con ulteriori verifiche."]'::jsonb,
  'RandAI guida secondo la procedura interna. Prima di interventi elettrici o su parti in pressione, applicare le procedure di sicurezza e le competenze autorizzate.',
  'Procedura interna Hotel Giò','approved',1,now()
)
on conflict (id) do update set summary=excluded.summary,keywords=excluded.keywords,steps=excluded.steps,caution=excluded.caution,source_label=excluded.source_label,status='approved',updated_at=now();

insert into public.randai_equipment(id,hotel_id,name,category,location,description)
values ('hotelgio-jazz-ac-outdoor-01','hotelgio','Motore esterno climatizzazione Jazz','climatizzazione','1° Jazz esterno','Unità esterna che gestisce l’aria condizionata dei quattro piani Jazz.')
on conflict (id) do update set name=excluded.name,location=excluded.location,description=excluded.description,active=true,updated_at=now();

insert into public.randai_equipment_serves(equipment_id,served_area,note) values
('hotelgio-jazz-ac-outdoor-01','1° Jazz','Servito dal motore comune Jazz'),
('hotelgio-jazz-ac-outdoor-01','2° Jazz','Servito dal motore comune Jazz'),
('hotelgio-jazz-ac-outdoor-01','3° Jazz','Servito dal motore comune Jazz'),
('hotelgio-jazz-ac-outdoor-01','4° Jazz','Servito dal motore comune Jazz')
on conflict (equipment_id,served_area) do update set note=excluded.note;
