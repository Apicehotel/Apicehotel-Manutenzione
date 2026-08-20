-- Stage authenticated policies for the legacy operational tables.
-- Existing public compatibility policies are intentionally left in place until
-- the frontend switches to the real pin-auth session, so the current deployment
-- is not broken during the migration.

-- Hotel-scoped generic read/write tables.
create policy camere_giorno_member_select on public.camere_giorno for select to authenticated using (public.is_hotel_member(hotel_id));
create policy camere_giorno_staff_write on public.camere_giorno for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy camere_lavoro_member_select on public.camere_lavoro for select to authenticated using (public.is_hotel_member(hotel_id));
create policy camere_lavoro_staff_write on public.camere_lavoro for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy import_camere_member_select on public.import_camere for select to authenticated using (public.is_hotel_member(hotel_id));
create policy import_camere_staff_write on public.import_camere for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy interventi_member_select on public.interventi for select to authenticated using (public.is_hotel_member(hotel_id));
create policy interventi_staff_write on public.interventi for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy planning_lavori_member_select on public.planning_lavori for select to authenticated using (public.is_hotel_member(hotel_id));
create policy planning_lavori_staff_write on public.planning_lavori for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy prenotazioni_sale_member_select on public.prenotazioni_sale for select to authenticated using (public.is_hotel_member(hotel_id));
create policy prenotazioni_sale_staff_write on public.prenotazioni_sale for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy richieste_urgenti_member_select on public.richieste_urgenti for select to authenticated using (public.is_hotel_member(hotel_id));
create policy richieste_urgenti_member_insert on public.richieste_urgenti for insert to authenticated with check (public.is_hotel_member(hotel_id));
create policy richieste_urgenti_staff_update on public.richieste_urgenti for update to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));
create policy richieste_urgenti_admin_delete on public.richieste_urgenti for delete to authenticated using (public.can_admin_hotel(hotel_id));

create policy segnalazioni_member_select on public.segnalazioni for select to authenticated using (public.is_hotel_member(hotel_id));
create policy segnalazioni_member_insert on public.segnalazioni for insert to authenticated with check (public.is_hotel_member(hotel_id));
create policy segnalazioni_staff_update on public.segnalazioni for update to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));
create policy segnalazioni_admin_delete on public.segnalazioni for delete to authenticated using (public.can_admin_hotel(hotel_id));

create policy tecnici_member_select on public.tecnici for select to authenticated using (public.is_hotel_member(hotel_id));
create policy tecnici_staff_write on public.tecnici for all to authenticated using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])) with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy push_subscriptions_member_select on public.push_subscriptions for select to authenticated using (public.is_hotel_member(hotel_id));
create policy push_subscriptions_member_insert on public.push_subscriptions for insert to authenticated with check (public.is_hotel_member(hotel_id));
create policy push_subscriptions_member_delete on public.push_subscriptions for delete to authenticated using (public.is_hotel_member(hotel_id));

-- Child table inherits authorization from its planning_lavori parent.
create policy planning_lavori_giorni_member_select on public.planning_lavori_giorni for select to authenticated using (
  exists (select 1 from public.planning_lavori p where p.id = lavoro_id and public.is_hotel_member(p.hotel_id))
);
create policy planning_lavori_giorni_staff_write on public.planning_lavori_giorni for all to authenticated using (
  exists (select 1 from public.planning_lavori p where p.id = lavoro_id and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore']))
) with check (
  exists (select 1 from public.planning_lavori p where p.id = lavoro_id and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore']))
);

-- Hotel directory can be read after authentication; writes are service/admin migration only.
create policy hotels_authenticated_select on public.hotels for select to authenticated using (true);

-- App config is readable after authentication. Writes are not exposed in the final policy set.
create policy app_config_authenticated_select on public.app_config for select to authenticated using (true);

-- Legacy utenti should not expose PINs once compatibility policy is removed.
-- Signed-in users may read directory rows only for hotels they belong to.
create policy utenti_member_select on public.utenti for select to authenticated using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.active
      and hm.hotel_id = any(utenti.hotels)
  )
);

-- User administration is restricted to users with admin membership in at least one target hotel.
create policy utenti_admin_update on public.utenti for update to authenticated using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.active and hm.can_access_admin
      and hm.hotel_id = any(utenti.hotels)
  )
) with check (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.active and hm.can_access_admin
      and hm.hotel_id = any(utenti.hotels)
  )
);
