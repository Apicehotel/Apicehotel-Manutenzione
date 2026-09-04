create or replace function public.prendi_urgente(p_id uuid, p_hotel_id text, p_nome text)
returns public.richieste_urgenti
language plpgsql
set search_path to 'public'
as $function$
declare v_row public.richieste_urgenti;
begin
  update public.richieste_urgenti
     set stato='presa', presa_in_carico_da=p_nome, presa_in_carico_il=now(), presa_in_carico_version=presa_in_carico_version+1, updated_at=now()
   where id=p_id
     and (p_hotel_id is null or p_hotel_id='' or hotel_id=p_hotel_id)
     and stato='aperta'
   returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.richieste_urgenti
     where id=p_id and (p_hotel_id is null or p_hotel_id='' or hotel_id=p_hotel_id);
    if v_row.id is null then raise exception 'Avviso urgente non trovato' using errcode='P0002'; end if;
    raise exception 'Avviso già preso in carico da %', coalesce(v_row.presa_in_carico_da,'un altro utente') using errcode='P0001';
  end if;
  return v_row;
end;
$function$;

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

drop trigger if exists trg_cancel_urgent_reminders_on_status_change on public.richieste_urgenti;
create trigger trg_cancel_urgent_reminders_on_status_change
after update of stato on public.richieste_urgenti
for each row
when (old.stato is distinct from new.stato)
execute function public.cancel_urgent_reminders_on_status_change();
