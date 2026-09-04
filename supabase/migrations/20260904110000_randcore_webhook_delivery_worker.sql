-- RandCore Point 3: safely claim and finish outbound webhook deliveries.
-- The queue remains service-only; the worker is the only delivery authority.

alter table public.rand_webhook_deliveries
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

create index if not exists rand_webhook_deliveries_lease_idx
  on public.rand_webhook_deliveries(status, locked_at, next_attempt_at);

create or replace function public.rand_claim_webhook_deliveries(
  p_limit integer default 20,
  p_worker_id text default null
)
returns table (
  delivery_id uuid,
  event_id uuid,
  subscription_id uuid,
  attempts integer,
  event_type text,
  aggregate_type text,
  aggregate_id text,
  hotel_id text,
  operation text,
  occurred_at timestamptz,
  source text,
  correlation_id text,
  idempotency_key text,
  payload jsonb,
  endpoint_url text,
  secret_ref text,
  worker_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id text := coalesce(nullif(btrim(p_worker_id), ''), gen_random_uuid()::text);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  return query
  with candidates as (
    select d.id
    from public.rand_webhook_deliveries d
    where (
      (d.status = 'pending' and d.next_attempt_at <= now())
      or (
        d.status = 'processing'
        and d.locked_at is not null
        and d.locked_at < now() - interval '10 minutes'
      )
    )
    order by d.next_attempt_at asc, d.created_at asc
    limit v_limit
    for update skip locked
  ), claimed as (
    update public.rand_webhook_deliveries d
    set status = 'processing',
        attempts = d.attempts + 1,
        locked_at = now(),
        locked_by = v_worker_id,
        next_attempt_at = now() + interval '10 minutes',
        last_error = null
    from candidates c
    where d.id = c.id
    returning d.*
  )
  select d.id, d.event_id, d.subscription_id, d.attempts,
         e.event_type, e.aggregate_type, e.aggregate_id, e.hotel_id,
         e.operation, e.occurred_at, e.source, e.correlation_id,
         e.idempotency_key, e.payload, s.endpoint_url, s.secret_ref,
         v_worker_id
  from claimed d
  join public.rand_domain_events e on e.id = d.event_id
  join public.rand_webhook_subscriptions s on s.id = d.subscription_id
  where s.active = true;
end;
$$;

create or replace function public.rand_finish_webhook_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_outcome text,
  p_error text default null,
  p_next_attempt_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_outcome not in ('delivered', 'retry', 'dead_letter') then
    raise exception 'invalid_webhook_delivery_outcome';
  end if;

  v_status := case p_outcome
    when 'delivered' then 'delivered'
    when 'retry' then 'pending'
    else 'dead_letter'
  end;

  update public.rand_webhook_deliveries
  set status = v_status,
      delivered_at = case when p_outcome = 'delivered' then now() else null end,
      last_error = nullif(left(coalesce(p_error, ''), 1000), ''),
      next_attempt_at = coalesce(p_next_attempt_at, now()),
      locked_at = null,
      locked_by = null
  where id = p_delivery_id
    and status = 'processing'
    and locked_by = p_worker_id;

  if not found then
    return 'not_owner';
  end if;
  return v_status;
end;
$$;

revoke all on function public.rand_claim_webhook_deliveries(integer, text) from public, anon, authenticated;
revoke all on function public.rand_finish_webhook_delivery(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.rand_claim_webhook_deliveries(integer, text) to service_role;
grant execute on function public.rand_finish_webhook_delivery(uuid, text, text, text, timestamptz) to service_role;

comment on function public.rand_claim_webhook_deliveries(integer, text) is
  'Service-only atomic claim with a ten-minute lease for RandCore webhook deliveries.';
comment on function public.rand_finish_webhook_delivery(uuid, text, text, text, timestamptz) is
  'Service-only guarded completion/retry/dead-letter transition for a webhook delivery.';

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
          'x-cron-secret', (select value from public.edge_function_secrets where key = 'reminder_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );$cmd$
    );
  end if;
end $$;

