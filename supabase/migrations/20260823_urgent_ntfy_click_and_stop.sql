-- Harden urgent takeover when the client cannot resolve hotel_id from cache.
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

-- Stop pending reminders immediately as soon as an urgent leaves the open state.
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

update public.urgent_reminder_jobs j
set status='cancelled', updated_at=now(), last_error=null
from public.richieste_urgenti r
where r.id=j.urgent_id and r.stato<>'aperta' and j.status in ('pending','processing');

-- Use the stable production alias instead of an obsolete Vercel project alias.
create or replace function public.dispatch_initial_urgent_ntfy()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  cfg jsonb;
  enabled_flag boolean;
  topic text;
  server text;
  title text;
  message text;
begin
  if new.stato <> 'aperta' then return new; end if;
  select enabled, config into enabled_flag, cfg from public.integration_settings where key='ntfy_alerts';
  if coalesce(enabled_flag,false) is not true then return new; end if;
  topic := coalesce(cfg->'topics'->>new.hotel_id,'');
  if topic='' then return new; end if;
  server := rtrim(coalesce(cfg->>'server','https://ntfy.sh'),'/');
  title := (case when new.gravita='emergenza' then 'EMERGENZA' else 'URGENTE' end) || ' · ' || case new.hotel_id when 'hotelgio' then 'Hotel Giò' when 'chocohotel' then 'Chocohotel' when 'brigantino' then 'Hotel Il Brigantino' else new.hotel_id end;
  message := concat_ws(' · ', nullif(new.posizione,''), nullif(new.reparto,''), nullif(new.nota,''));
  perform net.http_post(
    url := server,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'topic', topic,
      'title', title,
      'message', coalesce(nullif(message,''),'Nuovo avviso urgente RandApp'),
      'priority', 5,
      'tags', jsonb_build_array('rotating_light','warning'),
      'click', 'https://apicehotel.vercel.app/?notification=urgent&hotel_id=' || new.hotel_id || '&urgent_id=' || new.id::text
    ),
    timeout_milliseconds := 10000
  );
  insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli)
  values(new.id,new.hotel_id,'ntfy_iniziale','Sistema',jsonb_build_object('priority',5,'click_base','https://apicehotel.vercel.app'));
  return new;
exception when others then
  return new;
end;
$function$;
