create table if not exists public.urgent_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  urgent_id uuid not null references public.richieste_urgenti(id) on delete cascade,
  hotel_id text not null,
  channel text not null check (channel in ('ntfy','whatsapp')),
  step smallint not null,
  scheduled_at timestamptz not null,
  next_attempt_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','blocked','failed')),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (urgent_id, channel, step)
);
create index if not exists urgent_reminder_jobs_due_idx on public.urgent_reminder_jobs(status,next_attempt_at);
create index if not exists urgent_reminder_jobs_urgent_idx on public.urgent_reminder_jobs(urgent_id);
alter table public.urgent_reminder_jobs enable row level security;
revoke all on public.urgent_reminder_jobs from anon, authenticated;

create or replace function public.enqueue_urgent_reminders()
returns trigger language plpgsql security definer set search_path=public as $$
declare offset_seconds integer; step_no integer:=1; due timestamptz;
begin
  if new.stato<>'aperta' then return new; end if;
  foreach offset_seconds in array array[30,60,90,120,150,180] loop
    due:=new.creato_il+make_interval(secs=>offset_seconds);
    insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at,next_attempt_at)
    values(new.id,new.hotel_id,'ntfy',step_no,due,due)
    on conflict (urgent_id,channel,step) do nothing;
    step_no:=step_no+1;
  end loop;
  due:=new.creato_il+case when new.gravita='emergenza' then interval '0 seconds' else interval '180 seconds' end;
  insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at,next_attempt_at)
  values(new.id,new.hotel_id,'whatsapp',1,due,due)
  on conflict (urgent_id,channel,step) do nothing;
  return new;
end;$$;

drop trigger if exists trg_enqueue_urgent_reminders on public.richieste_urgenti;
create trigger trg_enqueue_urgent_reminders after insert on public.richieste_urgenti for each row execute function public.enqueue_urgent_reminders();

create or replace function public.cancel_urgent_reminders()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.stato='aperta' and new.stato<>'aperta' then
    update public.urgent_reminder_jobs set status='cancelled',updated_at=now(),last_error=null
    where urgent_id=new.id and status in ('pending','processing');
  end if;
  return new;
end;$$;

drop trigger if exists trg_cancel_urgent_reminders on public.richieste_urgenti;
create trigger trg_cancel_urgent_reminders after update of stato on public.richieste_urgenti for each row execute function public.cancel_urgent_reminders();

create or replace function public.dispatch_initial_urgent_ntfy()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare cfg jsonb; enabled_flag boolean; topic text; server text; title text; message text;
begin
  if new.stato<>'aperta' then return new; end if;
  select enabled,config into enabled_flag,cfg from public.integration_settings where key='ntfy_alerts';
  if coalesce(enabled_flag,false) is not true then return new; end if;
  topic:=coalesce(cfg->'topics'->>new.hotel_id,''); if topic='' then return new; end if;
  server:=rtrim(coalesce(cfg->>'server','https://ntfy.sh'),'/');
  title:=(case when new.gravita='emergenza' then 'EMERGENZA' else 'URGENTE' end)||' · '||case new.hotel_id when 'hotelgio' then 'Hotel Giò' when 'chocohotel' then 'Chocohotel' when 'brigantino' then 'Hotel Il Brigantino' else new.hotel_id end;
  message:=concat_ws(' · ',nullif(new.posizione,''),nullif(new.reparto,''),nullif(new.nota,''));
  perform net.http_post(url:=server,headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('topic',topic,'title',title,'message',coalesce(nullif(message,''),'Nuovo avviso urgente RandApp'),'priority',5,'tags',jsonb_build_array('rotating_light','warning'),'click','https://apicehotel-manutenzionr.vercel.app/?notification=urgent&hotel_id='||new.hotel_id||'&urgent_id='||new.id::text),timeout_milliseconds:=10000);
  insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli) values(new.id,new.hotel_id,'ntfy_iniziale','Sistema',jsonb_build_object('priority',5));
  return new;
exception when others then return new;
end;$$;

drop trigger if exists trg_dispatch_initial_urgent_ntfy on public.richieste_urgenti;
create trigger trg_dispatch_initial_urgent_ntfy after insert on public.richieste_urgenti for each row execute function public.dispatch_initial_urgent_ntfy();

-- Il secret urgent_reminder_cron_secret viene impostato fuori dal repository.
-- Il job legge il secret al runtime, quindi non viene mai committato.
select cron.unschedule(jobid) from cron.job where jobname='urgent-reminder-worker-30s';
select cron.schedule('urgent-reminder-worker-30s','30 seconds',$$select net.http_post(url:='https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/urgent-reminder-worker',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.edge_function_secrets where key='urgent_reminder_cron_secret')),body:='{}'::jsonb,timeout_milliseconds:=20000);$$);
