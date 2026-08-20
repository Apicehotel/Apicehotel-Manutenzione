-- Remove accidental signed-in access to server maintenance cleanup.
revoke execute on function public.pulisci_richieste_urgenti_vecchie() from authenticated;

-- Temperature sensors: authenticated users can read; staff can update device state/config.
create policy sensori_temperatura_authenticated_select on public.sensori_temperatura
for select to authenticated using (true);
create policy sensori_temperatura_staff_update on public.sensori_temperatura
for update to authenticated
using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role in ('admin','responsabile','manutentore')))
with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role in ('admin','responsabile','manutentore')));

-- Complete legacy user admin lifecycle for the eventual removal of utenti_all.
create policy utenti_admin_insert on public.utenti
for insert to authenticated
with check (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id=(select auth.uid())
      and hm.active and hm.can_access_admin
      and hm.hotel_id = any(utenti.hotels)
  )
);
create policy utenti_admin_delete on public.utenti
for delete to authenticated
using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id=(select auth.uid())
      and hm.active and hm.can_access_admin
      and hm.hotel_id = any(utenti.hotels)
  )
);

-- App configuration writes are admin-only in the final policy set.
create policy app_config_admin_update on public.app_config
for update to authenticated
using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.can_access_admin))
with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.can_access_admin));
