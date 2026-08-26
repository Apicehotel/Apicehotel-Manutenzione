create table if not exists public.weather_alert_state (
  hotel_id text primary key,
  level text not null default 'ok' check (level in ('ok','warning','danger')),
  signature text,
  last_payload jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.weather_alert_state enable row level security;
revoke all on public.weather_alert_state from anon, authenticated;

insert into public.edge_function_secrets(key,value)
values ('weather_alert_cron_secret', encode(gen_random_bytes(32),'hex'))
on conflict (key) do nothing;

select cron.unschedule(jobid) from cron.job where jobname='weather-alert-worker-10m';
select cron.schedule(
  'weather-alert-worker-10m',
  '*/10 * * * *',
  $$select net.http_post(
    url:='https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/weather-alert-worker',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select value from public.edge_function_secrets where key='weather_alert_cron_secret')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=20000
  );$$
);
