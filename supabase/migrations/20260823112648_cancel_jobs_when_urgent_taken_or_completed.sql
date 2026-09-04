create or replace function public.cancel_urgent_reminders_on_status_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.stato is distinct from 'aperta' then
    update public.urgent_reminder_jobs
       set status='cancelled', updated_at=now(), last_error=null
     where urgent_id=new.id and status in ('pending','processing');
  end if;
  return new;
end;
$function$;
