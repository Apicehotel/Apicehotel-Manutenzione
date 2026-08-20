-- Ristruttura sensori_temperatura: da hotel_id singolo a 3 flag di visibilità.
-- Ogni sensore fisico eWeLink = una riga (device_id chiave). I flag decidono
-- su quali app-hotel il sensore è visibile; si spuntano dal pannello admin.
drop table if exists sensori_temperatura cascade;

create table sensori_temperatura (
  device_id           text primary key,
  nome                text,
  temperatura         numeric,
  umidita             text,
  online              boolean not null default true,
  in_allerta          boolean not null default false,
  ordine              integer default 99,
  -- visibilità per hotel (decisa dall'admin dal pannello)
  mostra_hotelgio     boolean not null default false,
  mostra_chocohotel   boolean not null default false,
  mostra_brigantino   boolean not null default false,
  aggiornato_il       timestamptz not null default now()
);

alter table sensori_temperatura enable row level security;
create policy sensori_temperatura_all on sensori_temperatura for all using (true) with check (true);
