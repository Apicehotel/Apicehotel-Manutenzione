select cron.unschedule(2);
select cron.schedule(
  'sync-sensori-temperatura-secure',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/sync-sensori-temperatura',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-sync-secret',(select value from public.edge_function_secrets where key='sensor_sync_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
