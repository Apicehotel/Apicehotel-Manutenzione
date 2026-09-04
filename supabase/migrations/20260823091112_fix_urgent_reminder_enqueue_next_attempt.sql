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
  if new.stato <> 'aperta' then return new; end if;
  foreach offset_seconds in array array[30,60,90,120,150,180]
  loop
    due := new.creato_il + make_interval(secs => offset_seconds);
    insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at,next_attempt_at)
    values(new.id,new.hotel_id,'ntfy',step_no,due,due)
    on conflict (urgent_id,channel,step) do nothing;
    step_no := step_no + 1;
  end loop;
  due := new.creato_il + case when new.gravita='emergenza' then interval '0 seconds' else interval '180 seconds' end;
  insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at,next_attempt_at)
  values(new.id,new.hotel_id,'whatsapp',1,due,due)
  on conflict (urgent_id,channel,step) do nothing;
  return new;
end;
$$;
