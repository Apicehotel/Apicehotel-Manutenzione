-- Rand Governance v1: declarative rules + immutable audit. Server-side only.
create table if not exists public.rand_governance_rules (
  id text primary key,
  version integer not null default 1 check (version >= 1),
  enabled boolean not null default true,
  priority integer not null default 0,
  event_type text not null check (length(trim(event_type)) > 0),
  scope text not null check (scope in ('HOTEL','SYSTEM')),
  hotel_id text null,
  condition jsonb not null default '{}'::jsonb,
  action_type text not null check (length(trim(action_type)) > 0),
  risk text not null check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  required_scopes text[] not null default '{}',
  action_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rand_governance_rules_scope_ck check ((scope='HOTEL' and hotel_id is not null) or (scope='SYSTEM' and hotel_id is null))
);
create index if not exists rand_governance_rules_event_idx on public.rand_governance_rules(enabled,event_type,scope,hotel_id,priority desc);

create table if not exists public.rand_governance_audit (
  audit_id text primary key,
  kind text not null check (kind in ('RULE_MATCH','SECURITY_DECISION','DOCTOR_FINDING','ACTION_OUTCOME')),
  occurred_at timestamptz not null,
  scope text not null check (scope in ('HOTEL','SYSTEM')),
  hotel_id text null,
  actor_id text null,
  event_id text null,
  job_id text null,
  intent_id text null,
  correlation_id text null,
  decision text null,
  reason_codes text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rand_governance_audit_scope_ck check ((scope='HOTEL' and hotel_id is not null) or (scope='SYSTEM' and hotel_id is null))
);
create index if not exists rand_governance_audit_hotel_time_idx on public.rand_governance_audit(hotel_id,occurred_at desc);
create index if not exists rand_governance_audit_correlation_idx on public.rand_governance_audit(correlation_id,occurred_at desc);

alter table public.rand_governance_rules enable row level security;
alter table public.rand_governance_audit enable row level security;
revoke all on table public.rand_governance_rules from public, anon, authenticated;
revoke all on table public.rand_governance_audit from public, anon, authenticated;
grant select,insert,update,delete on table public.rand_governance_rules to service_role;
grant select,insert on table public.rand_governance_audit to service_role;

create or replace function public.rand_governance_audit_immutable() returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'RAND_GOVERNANCE_AUDIT_IMMUTABLE' using errcode='55000';
end; $$;
drop trigger if exists rand_governance_audit_immutable on public.rand_governance_audit;
create trigger rand_governance_audit_immutable before update or delete on public.rand_governance_audit for each row execute function public.rand_governance_audit_immutable();
revoke all on function public.rand_governance_audit_immutable() from public, anon, authenticated;
