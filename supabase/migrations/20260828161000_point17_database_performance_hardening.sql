-- Punto 17 completion: indici e piani RLS dopo il security hardening.

create index if not exists issue_attachments_issue_hotel_idx on public.issue_attachments(issue_id, hotel_id);
create index if not exists issue_events_issue_hotel_idx on public.issue_events(issue_id, hotel_id);
create index if not exists promemoria_invio_reminder_hotel_idx on public.promemoria_invio(promemoria_id, hotel_id);
create index if not exists richieste_urgenti_eventi_urgent_hotel_idx on public.richieste_urgenti_eventi(urgente_id, hotel_id);
create index if not exists urgent_reminder_jobs_urgent_hotel_idx on public.urgent_reminder_jobs(urgent_id, hotel_id);

drop index if exists public.urgent_events_hotel_created_idx;
drop index if exists public.tecnici_hotel_idx;

drop policy if exists diagnostic_events_insert_member on public.diagnostic_events;
create policy diagnostic_events_insert_member on public.diagnostic_events
for insert to authenticated
with check (auth_user_id = (select auth.uid()) and public.is_hotel_member(hotel_id));

drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own on public.notification_reads
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.hotel_id = notification_reads.hotel_id
      and hm.active
  )
);

drop policy if exists notification_reads_select_own_hotel on public.notification_reads;
create policy notification_reads_select_own_hotel on public.notification_reads
for select to authenticated
using (user_id = (select auth.uid()) and public.is_hotel_member(hotel_id));

drop policy if exists notification_reads_update_own_hotel on public.notification_reads;
create policy notification_reads_update_own_hotel on public.notification_reads
for update to authenticated
using (user_id = (select auth.uid()) and public.is_hotel_member(hotel_id))
with check (user_id = (select auth.uid()) and public.is_hotel_member(hotel_id));

drop policy if exists promemoria_select_members on public.promemoria;
create policy promemoria_select_members on public.promemoria
for select to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid())
    and hm.hotel_id = promemoria.hotel_id
    and hm.active
));

drop policy if exists promemoria_invio_select_members on public.promemoria_invio;
create policy promemoria_invio_select_members on public.promemoria_invio
for select to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid())
    and hm.hotel_id = promemoria_invio.hotel_id
    and hm.active
));

drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_insert on public.role_permissions
for insert to authenticated
with check (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
));
create policy role_permissions_admin_update on public.role_permissions
for update to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
))
with check (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
));
create policy role_permissions_admin_delete on public.role_permissions
for delete to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
));

drop policy if exists sensori_temperatura_admin_update on public.sensori_temperatura;
create policy sensori_temperatura_admin_update on public.sensori_temperatura
for update to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
))
with check (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid()) and hm.active and hm.can_access_admin
));

drop policy if exists sensori_temperatura_member_select on public.sensori_temperatura;
create policy sensori_temperatura_member_select on public.sensori_temperatura
for select to authenticated
using (exists (
  select 1 from public.hotel_memberships hm
  where hm.auth_user_id = (select auth.uid())
    and hm.active
    and (
      hm.can_access_admin
      or (hm.hotel_id in ('gio','hotelgio') and sensori_temperatura.mostra_hotelgio)
      or (hm.hotel_id = 'chocohotel' and sensori_temperatura.mostra_chocohotel)
      or (hm.hotel_id = 'brigantino' and sensori_temperatura.mostra_brigantino)
    )
));

drop policy if exists housekeeping_completions_permission_select on public.housekeeping_completions;
drop policy if exists housekeeping_completions_permission_write on public.housekeeping_completions;
create policy housekeeping_completions_permission_select on public.housekeeping_completions for select to authenticated using (public.has_app_permission(hotel_id,'housekeeping','view'));
create policy housekeeping_completions_permission_insert on public.housekeeping_completions for insert to authenticated with check (public.has_app_permission(hotel_id,'housekeeping','edit') or public.has_app_permission(hotel_id,'housekeeping','complete'));
create policy housekeeping_completions_permission_update on public.housekeeping_completions for update to authenticated using (public.has_app_permission(hotel_id,'housekeeping','edit') or public.has_app_permission(hotel_id,'housekeeping','complete')) with check (public.has_app_permission(hotel_id,'housekeeping','edit') or public.has_app_permission(hotel_id,'housekeeping','complete'));
create policy housekeeping_completions_permission_delete on public.housekeeping_completions for delete to authenticated using (public.has_app_permission(hotel_id,'housekeeping','edit'));

drop policy if exists sale_clients_permission_select on public.sale_clients;
drop policy if exists sale_clients_permission_write on public.sale_clients;
create policy sale_clients_permission_select on public.sale_clients for select to authenticated using (public.has_app_permission(hotel_id,'planning_sale','view'));
create policy sale_clients_permission_insert on public.sale_clients for insert to authenticated with check (public.has_app_permission(hotel_id,'planning_sale','manage'));
create policy sale_clients_permission_update on public.sale_clients for update to authenticated using (public.has_app_permission(hotel_id,'planning_sale','manage')) with check (public.has_app_permission(hotel_id,'planning_sale','manage'));
create policy sale_clients_permission_delete on public.sale_clients for delete to authenticated using (public.has_app_permission(hotel_id,'planning_sale','manage'));

drop policy if exists sale_layouts_permission_select on public.sale_layouts_config;
drop policy if exists sale_layouts_permission_write on public.sale_layouts_config;
create policy sale_layouts_permission_select on public.sale_layouts_config for select to authenticated using (public.has_app_permission(hotel_id,'planning_sale','view'));
create policy sale_layouts_permission_insert on public.sale_layouts_config for insert to authenticated with check (public.has_app_permission(hotel_id,'planning_sale','manage'));
create policy sale_layouts_permission_update on public.sale_layouts_config for update to authenticated using (public.has_app_permission(hotel_id,'planning_sale','manage')) with check (public.has_app_permission(hotel_id,'planning_sale','manage'));
create policy sale_layouts_permission_delete on public.sale_layouts_config for delete to authenticated using (public.has_app_permission(hotel_id,'planning_sale','manage'));
