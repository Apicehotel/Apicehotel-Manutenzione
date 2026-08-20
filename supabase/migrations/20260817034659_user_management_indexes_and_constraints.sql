create unique index if not exists hotel_memberships_user_hotel_unique on public.hotel_memberships(auth_user_id, hotel_id);
create index if not exists profiles_active_idx on public.profiles(active);
create index if not exists profiles_email_idx on public.profiles(lower(email)) where email is not null;

alter table public.auth_pin_credentials
  drop constraint if exists auth_pin_credentials_failed_attempts_check;
alter table public.auth_pin_credentials
  add constraint auth_pin_credentials_failed_attempts_check check (failed_attempts >= 0);
