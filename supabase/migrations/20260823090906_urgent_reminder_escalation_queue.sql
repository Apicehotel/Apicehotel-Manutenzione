create table if not exists public.urgent_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  urgent_id uuid not null references public.richieste_urgenti(id) on delete cascade,
  hotel_id text not null,
  channel text not null check (channel in ('ntfy','whatsapp')),
  step smallint not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','blocked','failed')),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (urgent_id, channel, step)
);
create index if not exists urgent_reminder_jobs_due_idx on public.urgent_reminder_jobs(status, scheduled_at);
create index if not exists urgent_reminder_jobs_urgent_idx on public.urgent_reminder_jobs(urgent_id);
alter table public.urgent_reminder_jobs enable row level security;
revoke all on public.urgent_reminder_jobs from anon, authenticated;

create or replace function public.enqueue_urgent_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  offset_seconds integer;
  step_no integer := 1;
begin
  if new.stato <> 'aperta' then return new; end if;
  -- ntfy iniziale viene inviato in parallelo da send-push; qui programmiamo i richiami.
  foreach offset_seconds in array array[30,60,90,120,150,180]
  loop
    insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at)
    values(new.id,new.hotel_id,'ntfy',step_no,new.creato_il + make_interval(secs => offset_seconds))
    on conflict (urgent_id,channel,step) do nothing;
    step_no := step_no + 1;
  end loop;
  -- WhatsApp e' robustezza: urgenza a 3 minuti, emergenza subito.
  insert into public.urgent_reminder_jobs(urgent_id,hotel_id,channel,step,scheduled_at)
  values(new.id,new.hotel_id,'whatsapp',1,new.creato_il + case when new.gravita='emergenza' then interval '0 seconds' else interval '180 seconds' end)
  on conflict (urgent_id,channel,step) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_urgent_reminders on public.richieste_urgenti;
create trigger trg_enqueue_urgent_reminders
after insert on public.richieste_urgenti
for each row execute function public.enqueue_urgent_reminders();

create or replace function public.cancel_urgent_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stato='aperta' and new.stato <> 'aperta' then
    update public.urgent_reminder_jobs
      set status='cancelled', updated_at=now(), last_error=null
      where urgent_id=new.id and status in ('pending','processing');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_urgent_reminders on public.richieste_urgenti;
create trigger trg_cancel_urgent_reminders
after update of stato on public.richieste_urgenti
for each row execute function public.cancel_urgent_reminders();

-- Valore REDATTO: il secret reale esiste solo in public.edge_function_secrets
-- sul database live, mai in git (vedi README).
insert into public.edge_function_secrets(key,value,updated_at)
values('urgent_reminder_cron_secret','REDACTED',now())
on conflict (key) do update set value=excluded.value, updated_at=now();

select cron.unschedule(jobid) from cron.job where jobname='urgent-reminder-worker-30s';
select cron.schedule(
  'urgent-reminder-worker-30s',
  '30 seconds',
  $$select net.http_post(
      url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/urgent-reminder-worker',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','REDACTED'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );$$
);
