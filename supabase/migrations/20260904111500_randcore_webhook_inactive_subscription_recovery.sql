-- RandCore Point 3 hardening: never leave deliveries blocked when a
-- service-plane webhook subscription is disabled during processing.

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
  update public.rand_webhook_deliveries d
  set status = 'dead_letter',
      last_error = 'subscription_inactive',
      locked_at = null,
      locked_by = null
  where d.status in ('pending', 'processing')
    and exists (
      select 1 from public.rand_webhook_subscriptions s
      where s.id = d.subscription_id and s.active = false
    );

  return query
  with candidates as (
    select d.id
    from public.rand_webhook_deliveries d
    join public.rand_webhook_subscriptions s
      on s.id = d.subscription_id and s.active = true
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
    for update of d skip locked
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

revoke all on function public.rand_claim_webhook_deliveries(integer, text) from public, anon, authenticated;
grant execute on function public.rand_claim_webhook_deliveries(integer, text) to service_role;

