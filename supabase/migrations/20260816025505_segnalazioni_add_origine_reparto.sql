alter table public.segnalazioni add column if not exists origine text default 'App';
alter table public.segnalazioni add column if not exists reparto text;
