create table if not exists public.user_notification_codes (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_notification_codes_six_digits check (code ~ '^[0-9]{6}$')
);

comment on table public.user_notification_codes is 'User-chosen six digit display aliases for RandApp notification channels. These codes are identifiers only and must never be used as authentication credentials or ntfy topics.';
comment on column public.user_notification_codes.code is 'Six digit human-facing alias; not a secret and not an authorization factor.';

alter table public.user_notification_codes enable row level security;

drop policy if exists user_notification_codes_select_own on public.user_notification_codes;
create policy user_notification_codes_select_own
on public.user_notification_codes for select
to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists user_notification_codes_insert_own on public.user_notification_codes;
create policy user_notification_codes_insert_own
on public.user_notification_codes for insert
to authenticated
with check (auth_user_id = (select auth.uid()));

drop policy if exists user_notification_codes_update_own on public.user_notification_codes;
create policy user_notification_codes_update_own
on public.user_notification_codes for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

revoke all on table public.user_notification_codes from anon;
grant select, insert, update on table public.user_notification_codes to authenticated;
grant select, insert, update, delete on table public.user_notification_codes to service_role;
