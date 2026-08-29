create or replace function public.has_any_randapp_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid()
      and hm.active = true
      and hm.role <> 'RandAI'
      and (hm.can_access_admin = true or hm.role = 'admin')
  );
$$;
revoke all on function public.has_any_randapp_admin() from public, anon;
grant execute on function public.has_any_randapp_admin() to authenticated, service_role;

drop policy if exists app_config_admin_update on public.app_config;
create policy app_config_admin_update on public.app_config for update to authenticated
using (public.has_any_randapp_admin())
with check (public.has_any_randapp_admin());

drop policy if exists role_permissions_admin_insert on public.role_permissions;
create policy role_permissions_admin_insert on public.role_permissions for insert to authenticated
with check (public.has_any_randapp_admin());
drop policy if exists role_permissions_admin_update on public.role_permissions;
create policy role_permissions_admin_update on public.role_permissions for update to authenticated
using (public.has_any_randapp_admin()) with check (public.has_any_randapp_admin());
drop policy if exists role_permissions_admin_delete on public.role_permissions;
create policy role_permissions_admin_delete on public.role_permissions for delete to authenticated
using (public.has_any_randapp_admin());

drop policy if exists utenti_admin_insert on public.utenti;
create policy utenti_admin_insert on public.utenti for insert to authenticated
with check (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = auth.uid() and hm.active and hm.role <> 'RandAI'
    and (hm.can_access_admin or hm.role='admin') and hm.hotel_id = any(utenti.hotels)
));
drop policy if exists utenti_admin_update on public.utenti;
create policy utenti_admin_update on public.utenti for update to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = auth.uid() and hm.active and hm.role <> 'RandAI'
    and (hm.can_access_admin or hm.role='admin') and hm.hotel_id = any(utenti.hotels)
))
with check (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = auth.uid() and hm.active and hm.role <> 'RandAI'
    and (hm.can_access_admin or hm.role='admin') and hm.hotel_id = any(utenti.hotels)
));
drop policy if exists utenti_admin_delete on public.utenti;
create policy utenti_admin_delete on public.utenti for delete to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = auth.uid() and hm.active and hm.role <> 'RandAI'
    and (hm.can_access_admin or hm.role='admin') and hm.hotel_id = any(utenti.hotels)
));