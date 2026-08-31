alter table public.utenti add column if not exists in_struttura_hotel_id text;

update public.utenti
set in_struttura = false,
    in_struttura_dal = null,
    in_struttura_via = null,
    in_struttura_hotel_id = null
where in_struttura = true
  and in_struttura_hotel_id is null;

create index if not exists idx_utenti_active_presence_hotel
  on public.utenti (in_struttura_hotel_id, in_struttura)
  where active = true and in_struttura = true;

comment on column public.utenti.in_struttura_hotel_id is
  'Hotel in cui la persona risulta fisicamente presente. Una persona puo avere una sola struttura attiva alla volta.';
