alter table public.prenotazioni_sale add column if not exists data_al date;
update public.prenotazioni_sale set data_al = data where data_al is null;
alter table public.prenotazioni_sale alter column data_al set not null;
