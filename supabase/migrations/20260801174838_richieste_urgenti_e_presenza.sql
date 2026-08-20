-- Porta Chocohotel in pari con Hotel Giò: richieste urgenti + presenza
-- manutentori (check-in manuale + GPS).

create table if not exists public.richieste_urgenti (
  id uuid primary key default gen_random_uuid(),
  nota text not null,
  creato_da text not null,
  creato_il timestamptz not null default now(),
  stato text not null default 'aperta',
  presa_in_carico_da text,
  presa_in_carico_il timestamptz
);

alter table public.richieste_urgenti enable row level security;

create policy "app access richieste_urgenti"
  on public.richieste_urgenti
  for all
  to public
  using (true)
  with check (true);

alter publication supabase_realtime add table public.richieste_urgenti;

-- Pulizia automatica ogni ora delle richieste più vecchie di 72 ore
create extension if not exists pg_cron;

create or replace function public.pulisci_richieste_urgenti_vecchie()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.richieste_urgenti
  where creato_il < now() - interval '72 hours';
$$;

select cron.schedule(
  'pulisci-richieste-urgenti-72h',
  '0 * * * *',
  $$select public.pulisci_richieste_urgenti_vecchie();$$
);

-- Presenza in struttura (check-in manuale + GPS) sugli utenti
alter table public.utenti
  add column if not exists in_struttura boolean not null default false,
  add column if not exists in_struttura_dal timestamptz,
  add column if not exists in_struttura_via text;
