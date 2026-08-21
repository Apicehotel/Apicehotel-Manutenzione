alter table public.interventi
  add column if not exists da_finire_da text,
  add column if not exists da_finire_il timestamptz;
