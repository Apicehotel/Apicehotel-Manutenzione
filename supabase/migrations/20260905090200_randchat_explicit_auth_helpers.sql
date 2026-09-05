-- Existing hotel helpers intentionally use auth.uid() and take one argument.
-- RandChat security-definer RPCs need explicit-user overloads without changing the legacy contract.
create or replace function public.is_hotel_member(target_hotel_id text, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = target_user_id
      and m.hotel_id = target_hotel_id
      and m.active = true
  );
$$;

create or replace function public.can_admin_hotel(target_hotel_id text, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = target_user_id
      and m.hotel_id = target_hotel_id
      and m.active = true
      and (m.can_access_admin = true or m.role = 'admin')
  );
$$;

revoke all on function public.is_hotel_member(text, uuid) from public, anon, authenticated;
revoke all on function public.can_admin_hotel(text, uuid) from public, anon, authenticated;
grant execute on function public.is_hotel_member(text, uuid) to service_role;
grant execute on function public.can_admin_hotel(text, uuid) to service_role;
