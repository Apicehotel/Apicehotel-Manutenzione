create or replace function public.protect_system_user_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system_protected then
    if tg_op = 'DELETE' then
      raise exception 'system protected user cannot be deleted';
    end if;
    if new.nome <> 'Randagio'
       or new.ruolo <> 'admin'
       or new.puo_admin is not true
       or new.active is not true
       or new.is_system_protected is not true
       or new.hotels <> array['hotelgio','chocohotel','brigantino']::text[] then
      raise exception 'system protected user core fields cannot be changed';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_system_user on public.utenti;
create trigger trg_protect_system_user
before update or delete on public.utenti
for each row execute function public.protect_system_user_row();

create or replace function public.protect_system_profile_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system_protected then
    if tg_op = 'DELETE' then
      raise exception 'system protected profile cannot be deleted';
    end if;
    if new.auth_user_id <> old.auth_user_id
       or new.legacy_user_id is distinct from old.legacy_user_id
       or new.display_name <> 'Randagio'
       or new.active is not true
       or new.is_system_protected is not true then
      raise exception 'system protected profile core fields cannot be changed';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_system_profile on public.profiles;
create trigger trg_protect_system_profile
before update or delete on public.profiles
for each row execute function public.protect_system_profile_row();

create or replace function public.protect_system_membership_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  protected_user boolean;
begin
  target_user := case when tg_op = 'INSERT' then new.auth_user_id else old.auth_user_id end;
  select coalesce(is_system_protected,false) into protected_user
  from public.profiles where auth_user_id = target_user;

  if protected_user then
    if tg_op = 'DELETE' then
      raise exception 'system protected membership cannot be deleted';
    end if;
    if new.role <> 'admin' or new.active is not true or new.can_access_admin is not true
       or new.hotel_id <> all(array['hotelgio','chocohotel','brigantino']::text[]) then
      raise exception 'invalid protected membership';
    end if;
    if tg_op = 'UPDATE' and new.hotel_id <> old.hotel_id then
      raise exception 'protected membership hotel cannot be changed';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_system_membership on public.hotel_memberships;
create trigger trg_protect_system_membership
before insert or update or delete on public.hotel_memberships
for each row execute function public.protect_system_membership_row();
