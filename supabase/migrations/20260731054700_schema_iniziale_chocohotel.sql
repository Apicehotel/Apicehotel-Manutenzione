-- Schema replicato da Hotel Giò, adattato per Chocohotel (nessun dato, solo struttura).

create extension if not exists pgcrypto;

create table public.utenti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ruolo text not null check (ruolo = any (array['direzione','governante','manutentore','reception','responsabile_area','direttore_congressi','sviluppatore','portiere_notturno'])),
  pin text not null,
  creato_il timestamptz default now(),
  zone_consentite text[],
  deve_cambiare_pin boolean default false
);

create table public.tecnici (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefono text,
  creato_il timestamptz default now()
);

create table public.app_config (
  key text primary key,
  value text
);

create table public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  camera text not null,
  urgenza text default 'media',
  categoria text default 'varie',
  stato text default 'todo',
  stato_camera text,
  note text,
  foto_prima text,
  foto_dopo text,
  creato_da text,
  creato_il timestamptz default now(),
  completato_da text,
  completato_il timestamptz,
  pezzo_nome text,
  pezzo_decisione text,
  pezzo_decisione_da text,
  attesa_da text,
  attesa_dal timestamptz,
  tecnico_id text,
  tecnico_nome text,
  tecnico_telefono text,
  tecnico_richiesto_da text,
  tecnico_richiesto_il timestamptz,
  tecnico_chiamato_da text,
  tecnico_chiamato_il timestamptz,
  tecnico_completato boolean default false,
  pezzo_sostituito text,
  pezzo_sostituito_da text,
  pezzo_sostituito_il timestamptz,
  tecnico_foto_inviata boolean default false,
  tecnico_sollecitato_da text,
  tecnico_sollecitato_il timestamptz
);

create table public.interventi (
  id uuid primary key default gen_random_uuid(),
  camera text not null,
  categoria text default 'varie',
  note text,
  programmato_il timestamptz,
  assegnatari jsonb default '[]'::jsonb,
  stato text default 'pending',
  creato_da text,
  creato_il timestamptz default now(),
  completato_da text,
  completato_il timestamptz,
  pezzo_nome text,
  pezzo_decisione text,
  pezzo_decisione_da text,
  attesa_da text,
  attesa_dal timestamptz,
  foto_dopo text,
  pezzo_sostituito text,
  pezzo_sostituito_da text,
  pezzo_sostituito_il timestamptz,
  camere jsonb,
  camere_fatte jsonb default '{}'::jsonb
);

create table public.prenotazioni_sale (
  id uuid primary key default gen_random_uuid(),
  sala text not null,
  data date not null,
  turno text not null check (turno = any (array['mattina','pomeriggio','tutto_giorno'])),
  cliente text not null,
  note text,
  creato_da text,
  creato_il timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_name text,
  role text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table public.whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  ricevuto_il timestamptz not null default now(),
  message_sid text unique,
  da_numero text not null,
  nome_profilo text,
  testo text,
  media_url text,
  camera_rilevata text,
  categoria_rilevata text,
  stato text not null default 'da_processare'
);

-- RLS: stessa impostazione permissiva di Hotel Giò (l'app usa la chiave
-- pubblica direttamente, senza autenticazione utente separata).
alter table public.utenti enable row level security;
alter table public.tecnici enable row level security;
alter table public.app_config enable row level security;
alter table public.segnalazioni enable row level security;
alter table public.interventi enable row level security;
alter table public.prenotazioni_sale enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.whatsapp_inbox enable row level security;

create policy "app access utenti" on public.utenti for all using (true) with check (true);
create policy "app access tecnici" on public.tecnici for all using (true) with check (true);
create policy "app access app_config" on public.app_config for all using (true) with check (true);
create policy "app access segnalazioni" on public.segnalazioni for all using (true) with check (true);
create policy "app access interventi" on public.interventi for all using (true) with check (true);
create policy "app access prenotazioni_sale" on public.prenotazioni_sale for all using (true) with check (true);
create policy "push_sub_all" on public.push_subscriptions for all using (true) with check (true);
create policy "lettura autenticati" on public.whatsapp_inbox for select using (true);
create policy "update autenticati" on public.whatsapp_inbox for update using (true);
