-- ATTENZIONE: valori reali REDATTI di proposito da Claude durante la
-- ricostruzione dei file di migrazione (2026-08-20). Questo repository è
-- pubblico: i valori veri (chiavi VAPID, credenziali eWeLink inclusa una
-- password in chiaro) esistevano nella migrazione originale applicata al
-- database, ma NON devono mai finire in un repo git pubblico. I valori
-- reali restano solo nella tabella public.edge_function_secrets del
-- database live (protetta da RLS, revocata per anon/authenticated).
--
-- Se questo file va rieseguito per ricreare l'ambiente, sostituire i
-- placeholder sottostanti con i valori reali PRIMA di applicarlo, e non
-- committare mai la versione con i valori reali.

create table if not exists public.edge_function_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.edge_function_secrets enable row level security;
revoke all on public.edge_function_secrets from anon, authenticated;

insert into public.edge_function_secrets(key,value) values
('vapid_public','<REDACTED_VAPID_PUBLIC_KEY>'),
('vapid_private','<REDACTED_VAPID_PRIVATE_KEY>'),
('vapid_subject','mailto:appmanutenzioneapice@gmail.com'),
('ewelink_app_id','<REDACTED_EWELINK_APP_ID>'),
('ewelink_app_secret','<REDACTED_EWELINK_APP_SECRET>'),
('ewelink_email','appmanutenzioneapice@gmail.com'),
('ewelink_password','<REDACTED_EWELINK_PASSWORD>'),
('sensor_sync_secret', encode(gen_random_bytes(32),'hex'))
on conflict (key) do nothing;

create or replace function public.get_edge_secret(p_key text)
returns text
language sql
security definer
set search_path = public
as $$ select value from public.edge_function_secrets where key = p_key $$;
revoke all on function public.get_edge_secret(text) from public, anon, authenticated;
grant execute on function public.get_edge_secret(text) to service_role;
