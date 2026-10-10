-- Isolate RandCore webhook worker auth from reminder-worker cron secret.
-- A leaked reminder cron secret must not be able to trigger webhook delivery.

create extension if not exists pgcrypto;

insert into public.edge_function_secrets (key, value)
values ('randcore_webhook_cron_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

do $$
declare
  v_job bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    for v_job in select jobid from cron.job where jobname = 'randcore-webhook-worker-1m' loop
      perform cron.unschedule(v_job);
    end loop;
    perform cron.schedule(
      'randcore-webhook-worker-1m',
      '* * * * *',
      $cmd$select net.http_post(
        url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/randcore-webhook-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select value from public.edge_function_secrets where key = 'randcore_webhook_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );$cmd$
    );
  end if;
end $$;
