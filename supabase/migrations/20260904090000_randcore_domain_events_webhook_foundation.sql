-- RandCore Point 1: one append-only event envelope for operational domains.
-- This is deliberately separate from notification_outbox: events describe
-- facts, while notifications describe delivery attempts.

create table if not exists public.rand_domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z0-9_.-]+$'),
  aggregate_type text not null,
  aggregate_id text not null,
  hotel_id text not null references public.hotels(id) on delete restrict,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  occurred_at timestamptz not null default now(),
  source text not null default 'database',
  correlation_id text,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists rand_domain_events_hotel_occurred_idx
  on public.rand_domain_events(hotel_id, occurred_at desc);
create index if not exists rand_domain_events_type_occurred_idx
  on public.rand_domain_events(event_type, occurred_at desc);

alter table public.rand_domain_events enable row level security;
revoke all on public.rand_domain_events from anon, authenticated;
grant all on public.rand_domain_events to service_role;

-- Webhook destinations are configured only by the service plane. Secrets are
-- referenced by name and never stored in this table.
create table if not exists public.rand_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  endpoint_url text not null check (endpoint_url ~ '^https://'),
  secret_ref text not null,
  event_types text[] not null default array['*']::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rand_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rand_domain_events(id) on delete cascade,
  subscription_id uuid not null references public.rand_webhook_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(event_id, subscription_id)
);

create index if not exists rand_webhook_deliveries_claim_idx
  on public.rand_webhook_deliveries(status, next_attempt_at);

alter table public.rand_webhook_subscriptions enable row level security;
alter table public.rand_webhook_deliveries enable row level security;
revoke all on public.rand_webhook_subscriptions from anon, authenticated;
revoke all on public.rand_webhook_deliveries from anon, authenticated;
grant all on public.rand_webhook_subscriptions to service_role;
grant all on public.rand_webhook_deliveries to service_role;

create or replace function public.rand_emit_domain_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record jsonb;
  v_hotel_id text;
  v_aggregate_id text;
  v_fingerprint text;
  v_event_id uuid;
begin
  v_record := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_hotel_id := nullif(v_record->>'hotel_id', '');
  v_aggregate_id := coalesce(nullif(v_record->>'id', ''), md5(v_record::text));

  -- Only hotel-scoped tables are attached to this trigger. Fail closed if a
  -- malformed row ever reaches it rather than creating a cross-hotel event.
  if v_hotel_id is null then
    return coalesce(new, old);
  end if;

  v_fingerprint := md5(v_record::text);
  insert into public.rand_domain_events(
    event_type, aggregate_type, aggregate_id, hotel_id, operation,
    source, idempotency_key, payload
  ) values (
    lower(tg_table_name || '.' || tg_op),
    tg_table_name,
    v_aggregate_id,
    v_hotel_id,
    tg_op,
    'database',
    tg_table_name || ':' || v_aggregate_id || ':' || tg_op || ':' || v_fingerprint,
    jsonb_build_object('table', tg_table_name, 'operation', tg_op, 'aggregate_id', v_aggregate_id)
  ) on conflict (idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.rand_webhook_deliveries(event_id, subscription_id)
    select v_event_id, s.id
    from public.rand_webhook_subscriptions s
    where s.active = true
      and ('*' = any(s.event_types) or lower(tg_table_name || '.' || tg_op) = any(s.event_types))
    on conflict (event_id, subscription_id) do nothing;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.rand_emit_domain_event() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'segnalazioni', 'interventi', 'richieste_urgenti', 'planning_lavori',
    'prenotazioni_sale', 'promemoria', 'supply_requests',
    'whatsapp_inbound_messages', 'technician_dispatch_requests'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists rand_domain_events_capture on public.%I', v_table);
      execute format(
        'create trigger rand_domain_events_capture after insert or update or delete on public.%I for each row execute function public.rand_emit_domain_event()',
        v_table
      );
    end if;
  end loop;
end $$;

comment on table public.rand_domain_events is 'Append-only, hotel-scoped facts for RandCore integrations and audit correlation.';
comment on table public.rand_webhook_deliveries is 'Service-only webhook delivery queue; notification_outbox remains the notification delivery authority.';
