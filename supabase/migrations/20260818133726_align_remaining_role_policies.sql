drop policy if exists planning_lavori_giorni_staff_insert on public.planning_lavori_giorni;
drop policy if exists planning_lavori_giorni_staff_update on public.planning_lavori_giorni;
drop policy if exists planning_lavori_giorni_staff_delete on public.planning_lavori_giorni;
create policy planning_lavori_giorni_staff_insert on public.planning_lavori_giorni for insert to authenticated with check (exists (select 1 from public.planning_lavori p where p.id = planning_lavori_giorni.lavoro_id and has_hotel_role(p.hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[])));
create policy planning_lavori_giorni_staff_update on public.planning_lavori_giorni for update to authenticated using (exists (select 1 from public.planning_lavori p where p.id = planning_lavori_giorni.lavoro_id and has_hotel_role(p.hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]))) with check (exists (select 1 from public.planning_lavori p where p.id = planning_lavori_giorni.lavoro_id and has_hotel_role(p.hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[])));
create policy planning_lavori_giorni_staff_delete on public.planning_lavori_giorni for delete to authenticated using (exists (select 1 from public.planning_lavori p where p.id = planning_lavori_giorni.lavoro_id and has_hotel_role(p.hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[])));

drop policy if exists attachments_staff_delete on public.issue_attachments;
create policy attachments_staff_delete on public.issue_attachments for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));

drop policy if exists events_staff_insert on public.issue_events;
create policy events_staff_insert on public.issue_events for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]) and actor_user_id = auth.uid() and issue_attachment_same_hotel(issue_id, hotel_id));

drop policy if exists sensori_temperatura_staff_update on public.sensori_temperatura;
create policy sensori_temperatura_staff_update on public.sensori_temperatura for update to authenticated using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id = auth.uid() and hm.active and hm.role = any(array['admin','Responsabile','Direzione','manutentore']::text[]))) with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id = auth.uid() and hm.active and hm.role = any(array['admin','Responsabile','Direzione','manutentore']::text[])));
