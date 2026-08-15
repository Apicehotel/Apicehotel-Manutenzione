-- ═══════════════════════════════════════════════════════════════════════════
-- Apice MultiHotel — Schema completo del database unico
-- ═══════════════════════════════════════════════════════════════════════════
-- Un solo database per tutti e 3 gli hotel (Hotel Giò, Chocohotel, Brigantino),
-- separati dalla colonna hotel_id. Prende il meglio dello schema maturo di
-- Hotel Giò (rodato dall'uso reale) e lo adatta al multi-hotel.
--
-- Note di design:
--  · hotel_id text su ogni tabella operativa → separa i tre hotel
--  · escluse le colonne/tabelle specifiche del bot WhatsApp e di eWeLink di
--    Hotel Giò (qui non presenti): tenuti solo i campi "logici" del tecnico
--  · RLS permissivo using(true): scelta deliberata (la separazione tra hotel
--    è gestita nel codice/query via hotel_id, non dalle policy)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Anagrafica hotel ────────────────────────────────────────────────────────
create table if not exists hotels (
  id          text primary key,          -- 'hotelgio' | 'chocohotel' | 'brigantino'
  nome        text not null,
  tinta       text,                       -- colore tema (es. '#0e5c49')
  creato_il   timestamptz not null default now()
);

-- ── Utenti (staff) ──────────────────────────────────────────────────────────
-- Un utente può lavorare su più hotel: la colonna hotels (array) elenca gli
-- hotel a cui ha accesso. PIN a 4 cifre (admin a 6, gestito a parte).
create table if not exists utenti (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  ruolo              text not null,
  pin                text not null,
  hotels             text[] not null default '{}',   -- hotel a cui l'utente ha accesso
  puo_admin          boolean not null default false,  -- flag per-persona: può entrare nel pannello admin unico
  zone_consentite    text[],
  telefono           text,
  deve_cambiare_pin  boolean default false,
  in_struttura       boolean not null default false,
  in_struttura_dal   timestamptz,
  in_struttura_via   text,                            -- 'manuale' | 'gps'
  creato_il          timestamptz default now()
);

-- ── Tecnici esterni ─────────────────────────────────────────────────────────
create table if not exists tecnici (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text references hotels(id),
  nome       text not null,
  telefono   text,
  creato_il  timestamptz default now()
);

-- ── Segnalazioni ────────────────────────────────────────────────────────────
-- Cuore dell'app. Stati: todo | tecnico | waiting | done.
-- Campi tecnico "logici" (richiesto/completato), senza la parte WhatsApp.
create table if not exists segnalazioni (
  id                    uuid primary key default gen_random_uuid(),
  hotel_id              text not null references hotels(id),
  camera                text not null,
  urgenza               text default 'media',        -- bassa | media | alta
  categoria             text default 'varie',
  stato                 text default 'todo',         -- todo | tecnico | waiting | done
  stato_camera          text,
  note                  text,
  foto_prima            text,                         -- base64 (migrazione a Storage futura)
  foto_dopo             text,
  creato_da             text,
  creato_il             timestamptz default now(),
  completato_da         text,
  completato_il         timestamptz,
  nota_completamento    text,
  -- gestione pezzo
  pezzo_nome            text,
  pezzo_decisione       text,                         -- 'ritiro' | 'ordine'
  pezzo_decisione_da    text,
  attesa_da             text,
  attesa_dal            timestamptz,
  pezzo_sostituito      text,
  pezzo_sostituito_da   text,
  pezzo_sostituito_il   timestamptz,
  -- tecnico esterno (solo campi logici, niente WhatsApp)
  tecnico_id            text,
  tecnico_nome          text,
  tecnico_telefono      text,
  tecnico_richiesto_da  text,
  tecnico_richiesto_il  timestamptz,
  tecnico_completato    boolean default false
);
create index if not exists idx_segnalazioni_hotel on segnalazioni(hotel_id);
create index if not exists idx_segnalazioni_stato on segnalazioni(hotel_id, stato);

-- ── Interventi programmati ──────────────────────────────────────────────────
create table if not exists interventi (
  id                    uuid primary key default gen_random_uuid(),
  hotel_id              text not null references hotels(id),
  camera                text not null,
  categoria             text default 'varie',
  note                  text,
  programmato_il        timestamptz,
  programmato_dal       timestamptz,
  programmato_al        timestamptz,
  assegnatari           jsonb default '[]'::jsonb,
  stato                 text default 'pending',
  camere                jsonb,
  camere_fatte          jsonb default '{}'::jsonb,
  piani                 jsonb default '[]'::jsonb,
  creato_da             text,
  creato_il             timestamptz default now(),
  completato_da         text,
  completato_il         timestamptz,
  pezzo_nome            text,
  pezzo_decisione       text,
  pezzo_decisione_da    text,
  attesa_da             text,
  attesa_dal            timestamptz,
  pezzo_sostituito      text,
  pezzo_sostituito_da   text,
  pezzo_sostituito_il   timestamptz,
  foto_dopo             text
);
create index if not exists idx_interventi_hotel on interventi(hotel_id);

-- ── Richieste urgenti ───────────────────────────────────────────────────────
create table if not exists richieste_urgenti (
  id                             uuid primary key default gen_random_uuid(),
  hotel_id                       text not null references hotels(id),
  nota                           varchar not null,
  stato                          text not null default 'aperta',   -- aperta | presa | completata
  creato_da                      text not null,
  creato_il                      timestamptz not null default now(),
  presa_in_carico_da             text,
  presa_in_carico_il             timestamptz,
  completata_da                  text,
  completata_il                  timestamptz,
  trasformata_in_segnalazione_id uuid
);
create index if not exists idx_urgenti_hotel on richieste_urgenti(hotel_id);

-- ── Sensori temperatura ─────────────────────────────────────────────────────
create table if not exists sensori_temperatura (
  device_id      text not null,
  hotel_id       text not null references hotels(id),
  nome           text not null,
  temperatura    numeric,
  umidita        text,
  online         boolean not null default true,
  in_allerta     boolean not null default false,
  ordine         integer default 99,
  aggiornato_il  timestamptz not null default now(),
  primary key (hotel_id, device_id)
);

-- ── Housekeeping: stato camere del giorno (da import Slope) ──────────────────
create table if not exists camere_giorno (
  hotel_id       text not null references hotels(id),
  camera         text not null,
  struttura      text not null,
  piano          integer not null,
  tipologia      text,
  stato_slope    text not null default 'libera',
  letti          text,
  note           text,
  arrivo         text,
  partenza       text,
  manuale        boolean not null default false,
  manuale_da     text,
  manuale_il     timestamptz,
  import_id      uuid,
  aggiornato_il  timestamptz not null default now(),
  primary key (hotel_id, camera)
);

-- ── Housekeeping: stato lavoro camere ───────────────────────────────────────
create table if not exists camere_lavoro (
  hotel_id       text not null references hotels(id),
  camera         text not null,
  stato          text not null default 'dafare',   -- dafare | fatta | ...
  da_chi         text,
  aggiornato_il  timestamptz not null default now(),
  primary key (hotel_id, camera)
);

-- ── Housekeeping: log import file Slope ─────────────────────────────────────
create table if not exists import_camere (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references hotels(id),
  caricato_da  text,
  caricato_il  timestamptz not null default now(),
  n_camere     integer,
  n_b2b        integer
);

-- ── Planning lavori ─────────────────────────────────────────────────────────
create table if not exists planning_lavori (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references hotels(id),
  descrizione  text not null,
  creato_da    text,
  creato_il    timestamptz not null default now()
);

create table if not exists planning_lavori_giorni (
  id         uuid primary key default gen_random_uuid(),
  lavoro_id  uuid not null references planning_lavori(id) on delete cascade,
  data       date not null,
  fatto      boolean not null default false,
  fatto_da   text,
  fatto_il   timestamptz,
  note       text,
  stato      text not null default 'aperto'
);
create index if not exists idx_planning_giorni_lavoro on planning_lavori_giorni(lavoro_id);

-- ── Prenotazioni sale (solo Hotel Giò lo usa, ma lo teniamo generico) ───────
create table if not exists prenotazioni_sale (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   text not null references hotels(id),
  sala       text not null,
  data       date not null,
  turno      text not null,
  cliente    text not null,
  note       text,
  creato_da  text,
  creato_il  timestamptz not null default now()
);
create index if not exists idx_prenotazioni_hotel on prenotazioni_sale(hotel_id);

-- ── Configurazione app (GLOBALE, non per-hotel) ─────────────────────────────
-- key/value semplice. Il pannello admin è UNICO e globale (non per-hotel),
-- quindi il PIN admin vive qui come singola voce condivisa da tutte le
-- strutture. Chi accede al pannello è deciso dal flag utenti.puo_admin.
create table if not exists app_config (
  key    text primary key,
  value  text
);

-- ── Push notifications ──────────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    text not null references hotels(id),
  utente      text,
  endpoint    text not null,
  p256dh      text,
  auth        text,
  creato_il   timestamptz default now()
);
create index if not exists idx_push_hotel on push_subscriptions(hotel_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: abilitato su tutte le tabelle, policy permissiva using(true).
-- Scelta deliberata: la separazione tra hotel è gestita nel codice via
-- hotel_id, non dalle policy. (Ignorare gli advisor Supabase su questo.)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
    and tablename in ('hotels','utenti','tecnici','segnalazioni','interventi',
      'richieste_urgenti','sensori_temperatura','camere_giorno','camere_lavoro',
      'import_camere','planning_lavori','planning_lavori_giorni','prenotazioni_sale',
      'app_config','push_subscriptions')
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t||'_all', t);
  end loop;
end $$;

-- ── Seed anagrafica hotel ───────────────────────────────────────────────────
insert into hotels (id, nome, tinta) values
  ('hotelgio',   'Hotel Giò',            '#0e5c49'),
  ('chocohotel', 'ChocoHotel',           '#640A0A'),
  ('brigantino', 'Hotel Il Brigantino',  '#0B5FA5')
on conflict (id) do nothing;
