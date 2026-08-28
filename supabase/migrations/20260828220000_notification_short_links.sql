-- RandApp notification short links: keep human aliases separate from secret ntfy topics.
-- Existing users receive a random six-digit alias code; future active profiles receive one automatically.

create or replace function public.allocate_user_notification_code(p_auth_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  candidate text;
  attempts integer := 0;
begin
  select code into existing_code from public.user_notification_codes where auth_user_id = p_auth_user_id;
  if existing_code is not null then return existing_code; end if;

  loop
    attempts := attempts + 1;
    if attempts > 100 then raise exception 'notification_code_allocation_failed'; end if;
    candidate := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    begin
      insert into public.user_notification_codes(auth_user_id, code)
      values (p_auth_user_id, candidate)
      on conflict (auth_user_id) do nothing;
      select code into existing_code from public.user_notification_codes where auth_user_id = p_auth_user_id;
      if existing_code is not null then return existing_code; end if;
    exception when unique_violation then
      -- Collision on the public alias only; retry without exposing or changing any ntfy topic.
      null;
    end;
  end loop;
end;
$$;

revoke all on function public.allocate_user_notification_code(uuid) from public, anon, authenticated;
grant execute on function public.allocate_user_notification_code(uuid) to service_role;

create or replace function public.ensure_profile_notification_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active is true and new.auth_user_id is not null then
    perform public.allocate_user_notification_code(new.auth_user_id);
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_profile_notification_code() from public, anon, authenticated;

drop trigger if exists profiles_notification_code_auto on public.profiles;
create trigger profiles_notification_code_auto
after insert or update of active on public.profiles
for each row
when (new.active is true)
execute function public.ensure_profile_notification_code();

-- Reserve the requested Randagio alias before allocating the remaining users.
insert into public.user_notification_codes(auth_user_id, code)
select auth_user_id, '191178'
from public.profiles
where active is true and lower(display_name) = 'randagio'
on conflict (auth_user_id) do update set code = excluded.code, updated_at = now();

do $$
declare r record;
begin
  for r in
    select p.auth_user_id
    from public.profiles p
    where p.active is true
      and p.auth_user_id is not null
      and not exists (select 1 from public.user_notification_codes c where c.auth_user_id = p.auth_user_id)
  loop
    perform public.allocate_user_notification_code(r.auth_user_id);
  end loop;
end;
$$;

comment on function public.allocate_user_notification_code(uuid) is
'Allocates a unique six-digit public RandApp alias. It is never an authentication credential and never an ntfy topic.';
