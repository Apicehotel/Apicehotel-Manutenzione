-- Correct the historical short-link seed before immutability is enforced on fresh replay.
-- Live production already has Domenico=191178 and Randagio=000003; this migration
-- makes repository replay converge to that state without relying on generated UUIDs.

do $$
declare
  domenico_id uuid;
  randagio_id uuid;
  domenico_code text;
  randagio_code text;
begin
  select auth_user_id into domenico_id
  from public.profiles
  where active is true and lower(display_name) = 'domenico'
  order by created_at nulls last
  limit 1;

  select auth_user_id into randagio_id
  from public.profiles
  where active is true and lower(display_name) = 'randagio'
  order by created_at nulls last
  limit 1;

  if domenico_id is null then
    raise exception 'Domenico profile not found for notification-code replay correction';
  end if;

  select code into domenico_code from public.user_notification_codes where auth_user_id = domenico_id;
  if randagio_id is not null then
    select code into randagio_code from public.user_notification_codes where auth_user_id = randagio_id;
  end if;

  -- Free the requested code first, then preserve the displaced user's previous code.
  if randagio_id is not null and randagio_id <> domenico_id then
    update public.user_notification_codes
    set code = coalesce(domenico_code, '000003'), updated_at = now()
    where auth_user_id = randagio_id;
  end if;

  update public.user_notification_codes
  set code = '191178', updated_at = now()
  where auth_user_id = domenico_id;

  if not found then
    insert into public.user_notification_codes(auth_user_id, code)
    values (domenico_id, '191178');
  end if;
end;
$$;
