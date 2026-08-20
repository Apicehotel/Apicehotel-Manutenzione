alter table public.utenti add column if not exists active boolean not null default true;
create index if not exists utenti_active_hotels_idx on public.utenti(active);
