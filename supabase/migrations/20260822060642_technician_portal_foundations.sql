-- Portale tecnici esterni: orario di arrivo previsto (comunicato dal tecnico
-- stesso) su segnalazioni e interventi, piu' la tabella dei token di accesso
-- al link personale (nessun PIN: il codice nel link e' la credenziale).
alter table public.segnalazioni
  add column if not exists tecnico_arrivo_previsto timestamptz;

alter table public.interventi
  add column if not exists tecnico_arrivo_previsto timestamptz;

create table if not exists public.technician_access_tokens (
  auth_user_id uuid primary key references public.profiles(auth_user_id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.technician_access_tokens enable row level security;
-- Nessuna policy pubblica: solo le edge function con service_role vi accedono
-- (RLS abilitata senza policy = accesso negato di default a chiunque altro).
