create or replace function public.dispatch_initial_urgent_ntfy()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
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
      'click', 'https://apicehotel-manutenzionr.vercel.app/?notification=urgent&hotel_id=' || new.hotel_id || '&urgent_id=' || new.id::text
    ),
    timeout_milliseconds := 10000
  );
  insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli)
  values(new.id,new.hotel_id,'ntfy_iniziale','Sistema',jsonb_build_object('priority',5));
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_dispatch_initial_urgent_ntfy on public.richieste_urgenti;
create trigger trg_dispatch_initial_urgent_ntfy
after insert on public.richieste_urgenti
for each row execute function public.dispatch_initial_urgent_ntfy();
