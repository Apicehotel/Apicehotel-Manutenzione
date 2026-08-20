create table if not exists hotels (
  id text primary key, nome text not null, tinta text, creato_il timestamptz not null default now()
);
create table if not exists utenti (
  id uuid primary key default gen_random_uuid(), nome text not null, ruolo text not null, pin text not null,
  hotels text[] not null default '{}', puo_admin boolean not null default false, zone_consentite text[], telefono text,
  deve_cambiare_pin boolean default false, in_struttura boolean not null default false,
  in_struttura_dal timestamptz, in_struttura_via text, creato_il timestamptz default now()
);
create table if not exists tecnici (
  id uuid primary key default gen_random_uuid(), hotel_id text references hotels(id), nome text not null, telefono text, creato_il timestamptz default now()
);
create table if not exists segnalazioni (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), camera text not null,
  urgenza text default 'media', categoria text default 'varie', stato text default 'todo', stato_camera text, note text,
  foto_prima text, foto_dopo text, creato_da text, creato_il timestamptz default now(), completato_da text, completato_il timestamptz,
  nota_completamento text, pezzo_nome text, pezzo_decisione text, pezzo_decisione_da text, attesa_da text, attesa_dal timestamptz,
  pezzo_sostituito text, pezzo_sostituito_da text, pezzo_sostituito_il timestamptz, tecnico_id text, tecnico_nome text,
  tecnico_telefono text, tecnico_richiesto_da text, tecnico_richiesto_il timestamptz, tecnico_completato boolean default false
);
create index if not exists idx_segnalazioni_hotel on segnalazioni(hotel_id);
create index if not exists idx_segnalazioni_stato on segnalazioni(hotel_id, stato);
create table if not exists interventi (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), camera text not null,
  categoria text default 'varie', note text, programmato_il timestamptz, programmato_dal timestamptz, programmato_al timestamptz,
  assegnatari jsonb default '[]'::jsonb, stato text default 'pending', camere jsonb, camere_fatte jsonb default '{}'::jsonb,
  piani jsonb default '[]'::jsonb, creato_da text, creato_il timestamptz default now(), completato_da text, completato_il timestamptz,
  pezzo_nome text, pezzo_decisione text, pezzo_decisione_da text, attesa_da text, attesa_dal timestamptz,
  pezzo_sostituito text, pezzo_sostituito_da text, pezzo_sostituito_il timestamptz, foto_dopo text
);
create index if not exists idx_interventi_hotel on interventi(hotel_id);
create table if not exists richieste_urgenti (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), nota varchar not null,
  stato text not null default 'aperta', creato_da text not null, creato_il timestamptz not null default now(),
  presa_in_carico_da text, presa_in_carico_il timestamptz, completata_da text, completata_il timestamptz,
  trasformata_in_segnalazione_id uuid
);
create index if not exists idx_urgenti_hotel on richieste_urgenti(hotel_id);
create table if not exists sensori_temperatura (
  device_id text not null, hotel_id text not null references hotels(id), nome text not null, temperatura numeric, umidita text,
  online boolean not null default true, in_allerta boolean not null default false, ordine integer default 99,
  aggiornato_il timestamptz not null default now(), primary key (hotel_id, device_id)
);
create table if not exists camere_giorno (
  hotel_id text not null references hotels(id), camera text not null, struttura text not null, piano integer not null,
  tipologia text, stato_slope text not null default 'libera', letti text, note text, arrivo text, partenza text,
  manuale boolean not null default false, manuale_da text, manuale_il timestamptz, import_id uuid,
  aggiornato_il timestamptz not null default now(), primary key (hotel_id, camera)
);
create table if not exists camere_lavoro (
  hotel_id text not null references hotels(id), camera text not null, stato text not null default 'dafare',
  da_chi text, aggiornato_il timestamptz not null default now(), primary key (hotel_id, camera)
);
create table if not exists import_camere (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), caricato_da text,
  caricato_il timestamptz not null default now(), n_camere integer, n_b2b integer
);
create table if not exists planning_lavori (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), descrizione text not null,
  creato_da text, creato_il timestamptz not null default now()
);
create table if not exists planning_lavori_giorni (
  id uuid primary key default gen_random_uuid(), lavoro_id uuid not null references planning_lavori(id) on delete cascade,
  data date not null, fatto boolean not null default false, fatto_da text, fatto_il timestamptz, note text, stato text not null default 'aperto'
);
create index if not exists idx_planning_giorni_lavoro on planning_lavori_giorni(lavoro_id);
create table if not exists prenotazioni_sale (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), sala text not null,
  data date not null, turno text not null, cliente text not null, note text, creato_da text, creato_il timestamptz not null default now()
);
create index if not exists idx_prenotazioni_hotel on prenotazioni_sale(hotel_id);
create table if not exists app_config (key text primary key, value text);
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(), hotel_id text not null references hotels(id), utente text,
  endpoint text not null, p256dh text, auth text, creato_il timestamptz default now()
);
create index if not exists idx_push_hotel on push_subscriptions(hotel_id);
