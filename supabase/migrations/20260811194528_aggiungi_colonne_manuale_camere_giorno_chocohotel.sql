alter table camere_giorno
  add column if not exists manuale boolean default false,
  add column if not exists manuale_da text,
  add column if not exists manuale_il timestamptz,
  add column if not exists aggiornato_il timestamptz;
