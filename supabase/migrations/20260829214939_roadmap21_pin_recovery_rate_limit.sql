create table if not exists public.pin_recovery_rate_limits (
  source_hash text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pin_recovery_rate_limits enable row level security;
revoke all privileges on table public.pin_recovery_rate_limits from public, anon, authenticated;
grant all privileges on table public.pin_recovery_rate_limits to service_role;
create index if not exists pin_recovery_rate_limits_updated_idx on public.pin_recovery_rate_limits(updated_at);