-- Punto 20 follow-up: ottimizzazione RLS senza cambiare la semantica autorizzativa.

drop policy if exists utenti_admin_insert on public.utenti;
create policy utenti_admin_insert on public.utenti for insert to authenticated with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role<>'RandAI' and (hm.can_access_admin or hm.role='admin') and hm.hotel_id=any(utenti.hotels)));

drop policy if exists utenti_admin_update on public.utenti;
create policy utenti_admin_update on public.utenti for update to authenticated using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role<>'RandAI' and (hm.can_access_admin or hm.role='admin') and hm.hotel_id=any(utenti.hotels))) with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role<>'RandAI' and (hm.can_access_admin or hm.role='admin') and hm.hotel_id=any(utenti.hotels)));

drop policy if exists utenti_admin_delete on public.utenti;
create policy utenti_admin_delete on public.utenti for delete to authenticated using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id=(select auth.uid()) and hm.active and hm.role<>'RandAI' and (hm.can_access_admin or hm.role='admin') and hm.hotel_id=any(utenti.hotels)));

drop policy if exists randai_chunks_manage_all on public.randai_document_chunks;
drop policy if exists randai_chunks_member_read on public.randai_document_chunks;
create policy randai_chunks_select on public.randai_document_chunks for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or (public.is_hotel_member(hotel_id) and exists (select 1 from public.randai_documents d where d.id=randai_document_chunks.document_id and d.status='approved')));
create policy randai_chunks_insert on public.randai_document_chunks for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_chunks_update on public.randai_document_chunks for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_chunks_delete on public.randai_document_chunks for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

drop policy if exists randai_documents_manage_all on public.randai_documents;
drop policy if exists randai_documents_member_read on public.randai_documents;
create policy randai_documents_select on public.randai_documents for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or (status='approved' and public.is_hotel_member(hotel_id)));
create policy randai_documents_insert on public.randai_documents for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_documents_update on public.randai_documents for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_documents_delete on public.randai_documents for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

drop policy if exists randai_equipment_manage_all on public.randai_equipment;
drop policy if exists randai_equipment_member_read on public.randai_equipment;
create policy randai_equipment_select on public.randai_equipment for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or (active and public.is_hotel_member(hotel_id)));
create policy randai_equipment_insert on public.randai_equipment for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_equipment_update on public.randai_equipment for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_equipment_delete on public.randai_equipment for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

drop policy if exists randai_equipment_serves_manage_all on public.randai_equipment_serves;
drop policy if exists randai_equipment_serves_member_read on public.randai_equipment_serves;
create policy randai_equipment_serves_select on public.randai_equipment_serves for select to authenticated using (exists (select 1 from public.randai_equipment e where e.id=randai_equipment_serves.equipment_id and (public.can_manage_randai_hotel(e.hotel_id) or (e.active and public.is_hotel_member(e.hotel_id)))));
create policy randai_equipment_serves_insert on public.randai_equipment_serves for insert to authenticated with check (exists (select 1 from public.randai_equipment e where e.id=randai_equipment_serves.equipment_id and public.can_manage_randai_hotel(e.hotel_id)));
create policy randai_equipment_serves_update on public.randai_equipment_serves for update to authenticated using (exists (select 1 from public.randai_equipment e where e.id=randai_equipment_serves.equipment_id and public.can_manage_randai_hotel(e.hotel_id))) with check (exists (select 1 from public.randai_equipment e where e.id=randai_equipment_serves.equipment_id and public.can_manage_randai_hotel(e.hotel_id)));
create policy randai_equipment_serves_delete on public.randai_equipment_serves for delete to authenticated using (exists (select 1 from public.randai_equipment e where e.id=randai_equipment_serves.equipment_id and public.can_manage_randai_hotel(e.hotel_id)));

drop policy if exists randai_memory_manage_all on public.randai_memory;
drop policy if exists randai_memory_member_read on public.randai_memory;
create policy randai_memory_select on public.randai_memory for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or public.is_hotel_member(hotel_id));
create policy randai_memory_insert on public.randai_memory for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_memory_update on public.randai_memory for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_memory_delete on public.randai_memory for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

drop policy if exists randai_procedures_manage_all on public.randai_procedures;
drop policy if exists randai_procedures_member_read on public.randai_procedures;
create policy randai_procedures_select on public.randai_procedures for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or (status='approved' and public.is_hotel_member(hotel_id)));
create policy randai_procedures_insert on public.randai_procedures for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_procedures_update on public.randai_procedures for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_procedures_delete on public.randai_procedures for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

drop policy if exists randai_sensor_bindings_manage_all on public.randai_sensor_bindings;
drop policy if exists randai_sensor_bindings_member_read on public.randai_sensor_bindings;
create policy randai_sensor_bindings_select on public.randai_sensor_bindings for select to authenticated using (public.can_manage_randai_hotel(hotel_id) or (active and public.is_hotel_member(hotel_id)));
create policy randai_sensor_bindings_insert on public.randai_sensor_bindings for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_sensor_bindings_update on public.randai_sensor_bindings for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randai_sensor_bindings_delete on public.randai_sensor_bindings for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));
