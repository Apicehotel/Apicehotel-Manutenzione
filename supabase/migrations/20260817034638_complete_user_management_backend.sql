alter table public.utenti alter column pin drop not null;

create table if not exists public.pin_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references public.profiles(auth_user_id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  request_ip_hash text
);

alter table public.pin_recovery_requests enable row level security;
revoke all on table public.pin_recovery_requests from anon, authenticated;

create index if not exists pin_recovery_requests_user_idx on public.pin_recovery_requests(auth_user_id, created_at desc);
create index if not exists pin_recovery_requests_expiry_idx on public.pin_recovery_requests(expires_at) where used_at is null;

alter table public.profiles add column if not exists last_pin_change_at timestamptz;
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists disabled_reason text;

create or replace function public.set_profile_active_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active = false and old.active = true then
    new.disabled_at := coalesce(new.disabled_at, now());
  elsif new.active = true and old.active = false then
    new.disabled_at := null;
    new.disabled_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_active_state on public.profiles;
create trigger trg_profiles_active_state
before update on public.profiles
for each row execute function public.set_profile_active_state();

create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone is not null and phone <> '';

create or replace function public.profile_has_active_membership(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_memberships hm
    join public.profiles p on p.auth_user_id = hm.auth_user_id
    where hm.auth_user_id = p_user and hm.active and p.active
  );
$$;
revoke all on function public.profile_has_active_membership(uuid) from public, anon, authenticated;
