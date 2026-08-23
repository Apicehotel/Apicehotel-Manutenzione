create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.segnalazioni add column if not exists mutation_id uuid, add column if not exists updated_at timestamptz not null default now();
alter table public.interventi add column if not exists mutation_id uuid, add column if not exists updated_at timestamptz not null default now();
alter table public.richieste_urgenti add column if not exists mutation_id uuid, add column if not exists updated_at timestamptz not null default now();

create unique index if not exists segnalazioni_mutation_id_key on public.segnalazioni(mutation_id) where mutation_id is not null;
create unique index if not exists interventi_mutation_id_key on public.interventi(mutation_id) where mutation_id is not null;
create unique index if not exists richieste_urgenti_mutation_id_key on public.richieste_urgenti(mutation_id) where mutation_id is not null;

create index if not exists segnalazioni_hotel_updated_at_idx on public.segnalazioni(hotel_id, updated_at desc);
create index if not exists interventi_hotel_updated_at_idx on public.interventi(hotel_id, updated_at desc);
create index if not exists richieste_urgenti_hotel_updated_at_idx on public.richieste_urgenti(hotel_id, updated_at desc);

drop trigger if exists trg_segnalazioni_updated_at on public.segnalazioni;
create trigger trg_segnalazioni_updated_at before update on public.segnalazioni for each row execute function public.set_row_updated_at();
drop trigger if exists trg_interventi_updated_at on public.interventi;
create trigger trg_interventi_updated_at before update on public.interventi for each row execute function public.set_row_updated_at();
drop trigger if exists trg_richieste_urgenti_updated_at on public.richieste_urgenti;
create trigger trg_richieste_urgenti_updated_at before update on public.richieste_urgenti for each row execute function public.set_row_updated_at();
