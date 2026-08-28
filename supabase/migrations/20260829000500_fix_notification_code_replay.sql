-- Correct the historical short-link seed on fresh replay.
-- Production already has Domenico=191178 and Randagio=000003. The immutable trigger
-- is suspended only inside this migration transaction and restored immediately.

drop trigger if exists trg_notification_code_immutable on public.user_notification_codes;

do $$
declare
  domenico_id uuid;
  randagio_id uuid;
  domenico_code text;
begin
  select auth_user_id into domenico_id
  from public.profiles
  where active is true and lower(display_name) = 'domenico'
  limit 1;

  select auth_user_id into randagio_id
  from public.profiles
  where active is true and lower(display_name) = 'randagio'
  limit 1;

  if domenico_id is null then
    raise exception 'Domenico profile not found for notification-code replay correction';
  end if;

  select code into domenico_code
  from public.user_notification_codes
  where auth_user_id = domenico_id;

  if randagio_id is not null and randagio_id <> domenico_id then
    update public.user_notification_codes
    set code = coalesce(domenico_code, '000003'), updated_at = now()
    where auth_user_id = randagio_id
      and code = '191178';
  end if;

  update public.user_notification_codes
  set code = '191178', updated_at = now()
  where auth_user_id = domenico_id
    and code <> '191178';

  if not exists (select 1 from public.user_notification_codes where auth_user_id = domenico_id) then
    insert into public.user_notification_codes(auth_user_id, code)
    values (domenico_id, '191178');
  end if;
end;
$$;

create trigger trg_notification_code_immutable
before update on public.user_notification_codes
for each row execute function public.prevent_notification_code_change();
