-- Notification codes are permanent once assigned/created.
-- Users may read their own code and insert it once, but never change or delete it.

drop policy if exists user_notification_codes_update_own on public.user_notification_codes;

revoke update, delete on table public.user_notification_codes from authenticated;

create or replace function public.prevent_notification_code_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.code is distinct from new.code or old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'notification_code_immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_notification_code_change() from public, anon, authenticated;

drop trigger if exists trg_notification_code_immutable on public.user_notification_codes;
create trigger trg_notification_code_immutable
before update on public.user_notification_codes
for each row execute function public.prevent_notification_code_change();

comment on column public.user_notification_codes.code is
  'Permanent six-digit notification identifier. Immutable after first assignment.';
