alter table public.prenotazioni_sale add column if not exists mutation_id uuid, add column if not exists updated_at timestamptz not null default now();
alter table public.feedback add column if not exists mutation_id uuid;

create unique index if not exists prenotazioni_sale_mutation_id_key on public.prenotazioni_sale(mutation_id) where mutation_id is not null;
create unique index if not exists feedback_mutation_id_key on public.feedback(mutation_id) where mutation_id is not null;
create index if not exists prenotazioni_sale_hotel_updated_at_idx on public.prenotazioni_sale(hotel_id, updated_at desc);

drop trigger if exists trg_prenotazioni_sale_updated_at on public.prenotazioni_sale;
create trigger trg_prenotazioni_sale_updated_at before update on public.prenotazioni_sale for each row execute function public.set_row_updated_at();
