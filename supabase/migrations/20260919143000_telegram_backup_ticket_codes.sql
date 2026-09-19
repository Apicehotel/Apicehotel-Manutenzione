-- Ticket univoci per hotel + modulo.
-- HG = Hotel Giò, HC = Chocohotel, HB = Hotel Il Brigantino.

alter table public.segnalazioni
  add column if not exists ticket_number bigint,
  add column if not exists ticket_code text;

alter table public.interventi
  add column if not exists ticket_number bigint,
  add column if not exists ticket_code text;

create table if not exists public.ticket_counters (
  entity text not null,
  hotel_id text not null references public.hotels(id) on delete cascade,
  next_value bigint not null default 1 check (next_value > 0),
  primary key (entity, hotel_id)
);

create or replace function public.hotel_ticket_prefix(p_hotel_id text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_hotel_id, ''))
    when 'hotelgio' then 'HG'
    when 'chocohotel' then 'HC'
    when 'brigantino' then 'HB'
    else upper(left(regexp_replace(coalesce(p_hotel_id, 'XX'), '[^a-zA-Z0-9]', '', 'g'), 2))
  end
$$;

-- Backfill stabile: ordine cronologico per ogni hotel.
with ranked as (
  select id, hotel_id,
         row_number() over (partition by hotel_id order by creato_il nulls last, id) as rn
  from public.segnalazioni
)
update public.segnalazioni s
set ticket_number = r.rn,
    ticket_code = public.hotel_ticket_prefix(r.hotel_id) || '-' || lpad(r.rn::text, 4, '0')
from ranked r
where s.id = r.id
  and (s.ticket_number is null or s.ticket_code is null);

with ranked as (
  select id, hotel_id,
         row_number() over (partition by hotel_id order by creato_il nulls last, id) as rn
  from public.interventi
)
update public.interventi i
set ticket_number = r.rn,
    ticket_code = public.hotel_ticket_prefix(r.hotel_id) || '-' || lpad(r.rn::text, 4, '0')
from ranked r
where i.id = r.id
  and (i.ticket_number is null or i.ticket_code is null);

insert into public.ticket_counters(entity, hotel_id, next_value)
select 'segnalazioni', h.id, coalesce(max(s.ticket_number), 0) + 1
from public.hotels h
left join public.segnalazioni s on s.hotel_id = h.id
group by h.id
on conflict (entity, hotel_id) do update
set next_value = greatest(public.ticket_counters.next_value, excluded.next_value);

insert into public.ticket_counters(entity, hotel_id, next_value)
select 'interventi', h.id, coalesce(max(i.ticket_number), 0) + 1
from public.hotels h
left join public.interventi i on i.hotel_id = h.id
group by h.id
on conflict (entity, hotel_id) do update
set next_value = greatest(public.ticket_counters.next_value, excluded.next_value);

create or replace function public.assign_hotel_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number bigint;
  v_prefix text;
begin
  if new.ticket_number is not null and new.ticket_code is not null then
    return new;
  end if;

  insert into public.ticket_counters(entity, hotel_id, next_value)
  values (tg_table_name, new.hotel_id, 2)
  on conflict (entity, hotel_id) do update
    set next_value = public.ticket_counters.next_value + 1
  returning next_value - 1 into v_number;

  v_prefix := public.hotel_ticket_prefix(new.hotel_id);
  new.ticket_number := v_number;
  new.ticket_code := v_prefix || '-' || lpad(v_number::text, 4, '0');
  return new;
end
$$;

drop trigger if exists trg_segnalazioni_ticket on public.segnalazioni;
create trigger trg_segnalazioni_ticket
before insert on public.segnalazioni
for each row execute function public.assign_hotel_ticket();

drop trigger if exists trg_interventi_ticket on public.interventi;
create trigger trg_interventi_ticket
before insert on public.interventi
for each row execute function public.assign_hotel_ticket();

create unique index if not exists uq_segnalazioni_ticket_code
  on public.segnalazioni(ticket_code) where ticket_code is not null;

create unique index if not exists uq_interventi_ticket_code
  on public.interventi(ticket_code) where ticket_code is not null;
