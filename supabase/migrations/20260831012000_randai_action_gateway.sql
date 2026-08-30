create table if not exists public.randai_action_gateway_settings (
  hotel_id text primary key,
  enabled boolean not null default true,
  auto_execute_low_risk boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.randai_action_gateway_settings (hotel_id, enabled, auto_execute_low_risk)
values
  ('hotelgio', true, false),
  ('chocohotel', true, false),
  ('brigantino', true, false)
on conflict (hotel_id) do nothing;

create table if not exists public.randai_action_audit (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  actor_auth_user_id uuid not null,
  actor_role text not null,
  action_type text not null,
  resource_type text not null,
  resource_id text not null,
  risk text not null check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  approval_id text,
  idempotency_key text not null unique,
  status text not null check (status in ('EXECUTED','FAILED','REJECTED')),
  before_state jsonb,
  requested_state jsonb,
  after_state jsonb,
  reason text,
  error_code text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index if not exists randai_action_audit_hotel_created_idx
  on public.randai_action_audit (hotel_id, created_at desc);
create index if not exists randai_action_audit_resource_idx
  on public.randai_action_audit (resource_type, resource_id, created_at desc);
create index if not exists randai_action_audit_actor_idx
  on public.randai_action_audit (actor_auth_user_id, created_at desc);

alter table public.randai_action_approvals
  add column if not exists hotel_id text,
  add column if not exists requested_by_auth_user_id uuid,
  add column if not exists action_type text,
  add column if not exists resource_type text,
  add column if not exists resource_id text,
  add column if not exists idempotency_key text;

create unique index if not exists randai_action_approvals_idempotency_idx
  on public.randai_action_approvals (idempotency_key)
  where idempotency_key is not null;
create index if not exists randai_action_approvals_actor_idx
  on public.randai_action_approvals (requested_by_auth_user_id, requested_at desc);

alter table public.randai_action_gateway_settings enable row level security;
alter table public.randai_action_audit enable row level security;

revoke all on table public.randai_action_gateway_settings from anon, authenticated;
revoke all on table public.randai_action_audit from anon, authenticated;
grant select, insert, update, delete on table public.randai_action_gateway_settings to service_role;
grant select, insert on table public.randai_action_audit to service_role;
