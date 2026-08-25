-- Priorita 5: ntfy immediato + ogni 30s fino a 5 minuti; WhatsApp a 2:30 e 5:00.
-- Tutti i richiami futuri vengono annullati non appena lo stato lascia 'aperta' (es. Vado).

create or replace function public.enqueue_urgent_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  offset_seconds integer;
  step_no integer := 1;
  due timestamptz;
begin
  if new.stato <> 'aperta' then
    return new;
  end if;

  -- ntfy: T+30, 60, 90, ... 300 secondi.
  -- T=0 resta gestito da dispatch_initial_urgent_ntfy().
  foreach offset_seconds in array array[30,60,90,120,150,180,210,240,270,300] loop
    due := new.creato_il + make_interval(secs => offset_seconds);
    insert into public.urgent_reminder_jobs(
      urgent_id, hotel_id, channel, step, scheduled_at, next_attempt_at
    ) values (
      new.id, new.hotel_id, 'ntfy', step_no, due, due
    )
    on conflict (urgent_id, channel, step) do nothing;
    step_no := step_no + 1;
  end loop;

  -- WhatsApp: T+2:30 e T+5:00, solo se nessuno ha ancora premuto Vado.
  insert into public.urgent_reminder_jobs(
    urgent_id, hotel_id, channel, step, scheduled_at, next_attempt_at
  ) values
    (new.id, new.hotel_id, 'whatsapp', 1, new.creato_il + interval '150 seconds', new.creato_il + interval '150 seconds'),
    (new.id, new.hotel_id, 'whatsapp', 2, new.creato_il + interval '300 seconds', new.creato_il + interval '300 seconds')
  on conflict (urgent_id, channel, step) do nothing;

  return new;
end;
$$;

-- Riallinea solo gli avvisi aperti molto recenti (max 5 minuti), senza riattivare urgenze vecchie.
-- Non modifica job gia inviati/failed/blocked; aggiunge soltanto gli step mancanti ancora nel futuro.
with recent_open as (
  select id, hotel_id, creato_il
  from public.richieste_urgenti
  where stato = 'aperta'
    and creato_il >= now() - interval '5 minutes'
),
ntfy_steps as (
  select r.id as urgent_id, r.hotel_id, r.creato_il, s.step, s.offset_seconds
  from recent_open r
  cross join (values
    (1,30),(2,60),(3,90),(4,120),(5,150),
    (6,180),(7,210),(8,240),(9,270),(10,300)
  ) as s(step, offset_seconds)
)
insert into public.urgent_reminder_jobs(
  urgent_id, hotel_id, channel, step, scheduled_at, next_attempt_at
)
select
  urgent_id,
  hotel_id,
  'ntfy',
  step,
  creato_il + make_interval(secs => offset_seconds),
  creato_il + make_interval(secs => offset_seconds)
from ntfy_steps
where creato_il + make_interval(secs => offset_seconds) > now()
on conflict (urgent_id, channel, step) do nothing;

with recent_open as (
  select id, hotel_id, creato_il
  from public.richieste_urgenti
  where stato = 'aperta'
    and creato_il >= now() - interval '5 minutes'
)
insert into public.urgent_reminder_jobs(
  urgent_id, hotel_id, channel, step, scheduled_at, next_attempt_at
)
select id, hotel_id, 'whatsapp', 1, creato_il + interval '150 seconds', creato_il + interval '150 seconds'
from recent_open
where creato_il + interval '150 seconds' > now()
on conflict (urgent_id, channel, step) do nothing;

with recent_open as (
  select id, hotel_id, creato_il
  from public.richieste_urgenti
  where stato = 'aperta'
    and creato_il >= now() - interval '5 minutes'
)
insert into public.urgent_reminder_jobs(
  urgent_id, hotel_id, channel, step, scheduled_at, next_attempt_at
)
select id, hotel_id, 'whatsapp', 2, creato_il + interval '300 seconds', creato_il + interval '300 seconds'
from recent_open
where creato_il + interval '300 seconds' > now()
on conflict (urgent_id, channel, step) do nothing;
