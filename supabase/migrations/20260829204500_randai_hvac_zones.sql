create table if not exists public.randai_hvac_zones (
  zone_id text primary key,
  hotel_id text not null,
  section text not null,
  floor integer,
  circuit text,
  label text not null,
  room_numbers integer[] not null default '{}',
  switch_device_id text,
  temperature_device_ids text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists randai_hvac_zones_hotel_section_idx
  on public.randai_hvac_zones (hotel_id, section, floor)
  where active = true;

alter table public.randai_hvac_zones enable row level security;

insert into public.randai_hvac_zones
  (zone_id, hotel_id, section, floor, circuit, label, room_numbers, switch_device_id, temperature_device_ids)
values
  ('hotelgio-wine-p1-a1','hotelgio','wine',1,'A1','Wine P1 · A1 · Camere 101–108',array[101,102,103,104,105,106,107,108],'10017d46b0',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p1-a2','hotelgio','wine',1,'A2','Wine P1 · A2 · Camere 109–125',array[109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125],'10013fe358',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p1-a3','hotelgio','wine',1,'A3','Wine P1 · A3 · Camere 126–131',array[126,127,128,129,130,131],'1000aaaf46',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p2-a1','hotelgio','wine',2,'A1','Wine P2 · A1 · Camere 201–204, 225–227',array[201,202,203,204,225,226,227],'1000ab2989',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p2-a2','hotelgio','wine',2,'A2','Wine P2 · A2 · Camere 205–224',array[205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224],'1000abbce0',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p2-a3','hotelgio','wine',2,'A3','Wine P2 · A3 · Camere 228–233',array[228,229,230,231,232,233],'1000aaefaa',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p3-a1','hotelgio','wine',3,'A1','Wine P3 · A1 · Camere 301–305, 324–326',array[301,302,303,304,305,324,325,326],'1000b56c92',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p3-a2','hotelgio','wine',3,'A2','Wine P3 · A2 · Camere 306–323',array[306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323],'1000abba90',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p3-a3','hotelgio','wine',3,'A3','Wine P3 · A3 · Camere 327–332',array[327,328,329,330,331,332],'1000abf392',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p4-a1','hotelgio','wine',4,'A1','Wine P4 · A1 · Camere 401–405, 426–428',array[401,402,403,404,405,426,427,428],'10023c3549',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p4-a2','hotelgio','wine',4,'A2','Wine P4 · A2 · Camere 406–425',array[406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425],'1000abe946',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-wine-p4-a3','hotelgio','wine',4,'A3','Wine P4 · A3 · Camere 429–434',array[429,430,431,432,433,434],'1000ab90d4',array['1001e22b8d','10025339c4','1001e22ba7']),
  ('hotelgio-jazz-p1','hotelgio','jazz',1,null,'Jazz · Piano 1',array[]::integer[],null,array['1002534102']),
  ('hotelgio-jazz-p2','hotelgio','jazz',2,null,'Jazz · Piano 2',array[]::integer[],null,array['10025340a7']),
  ('hotelgio-jazz-p3','hotelgio','jazz',3,null,'Jazz · Piano 3',array[]::integer[],null,array['10023c8674']),
  ('hotelgio-jazz-p4','hotelgio','jazz',4,null,'Jazz · Piano 4',array[]::integer[],null,array['1002534089'])
on conflict (zone_id) do update set
  hotel_id = excluded.hotel_id,
  section = excluded.section,
  floor = excluded.floor,
  circuit = excluded.circuit,
  label = excluded.label,
  room_numbers = excluded.room_numbers,
  switch_device_id = excluded.switch_device_id,
  temperature_device_ids = excluded.temperature_device_ids,
  active = excluded.active,
  updated_at = now();