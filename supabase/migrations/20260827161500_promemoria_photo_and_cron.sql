alter table public.promemoria add column if not exists photo_path text;
insert into public.edge_function_secrets(key,value)
values ('reminder_cron_secret', encode(gen_random_bytes(24),'hex'))
on conflict (key) do nothing;
do $$ begin
  perform cron.unschedule('reminder-worker-1m');
exception when others then null; end $$;
select cron.schedule('reminder-worker-1m','* * * * *',$$
  select net.http_post(
    url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/reminder-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select value from public.edge_function_secrets where key='reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
