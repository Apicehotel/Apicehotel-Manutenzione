create table if not exists sensori_temperatura (
  device_id text primary key,
  nome text,
  temperatura numeric,
  umidita text,
  online boolean,
  aggiornato_il timestamptz,
  ordine int,
  in_allerta boolean default false
);

alter table sensori_temperatura enable row level security;
create policy "sensori_temperatura_all" on sensori_temperatura for all using (true) with check (true);
alter publication supabase_realtime add table sensori_temperatura;
