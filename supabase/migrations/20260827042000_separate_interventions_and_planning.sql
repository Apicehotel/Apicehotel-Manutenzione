alter table public.interventi
  add column if not exists sezione text not null default 'intervento';

update public.interventi
set sezione = 'intervento'
where sezione is null or sezione not in ('intervento', 'planning');

alter table public.interventi
  drop constraint if exists interventi_sezione_check;

alter table public.interventi
  add constraint interventi_sezione_check
  check (sezione in ('intervento', 'planning'));

create index if not exists interventi_hotel_sezione_idx
  on public.interventi (hotel_id, sezione);
