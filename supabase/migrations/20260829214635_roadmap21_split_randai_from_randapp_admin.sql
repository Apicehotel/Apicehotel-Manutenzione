create or replace function public.can_manage_randai_hotel(target_hotel_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = auth.uid()
      and m.hotel_id = target_hotel_id
      and m.active = true
      and (
        m.role = 'RandAI'
        or (m.role <> 'RandAI' and (m.can_access_admin = true or m.role = 'admin'))
      )
  );
$$;
revoke all on function public.can_manage_randai_hotel(text) from public, anon;
grant execute on function public.can_manage_randai_hotel(text) to authenticated, service_role;

create or replace function public.can_admin_hotel(target_hotel_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = auth.uid()
      and m.hotel_id = target_hotel_id
      and m.active = true
      and m.role <> 'RandAI'
      and (m.can_access_admin = true or m.role = 'admin')
  );
$$;

drop policy if exists randai_chunks_admin_all on public.randai_document_chunks;
create policy randai_chunks_manage_all on public.randai_document_chunks for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
drop policy if exists randai_documents_admin_all on public.randai_documents;
create policy randai_documents_manage_all on public.randai_documents for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
drop policy if exists randai_equipment_admin_all on public.randai_equipment;
create policy randai_equipment_manage_all on public.randai_equipment for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
drop policy if exists randai_equipment_serves_admin_all on public.randai_equipment_serves;
create policy randai_equipment_serves_manage_all on public.randai_equipment_serves for all to authenticated using (exists (select 1 from public.randai_equipment e where e.id = equipment_id and public.can_manage_randai_hotel(e.hotel_id))) with check (exists (select 1 from public.randai_equipment e where e.id = equipment_id and public.can_manage_randai_hotel(e.hotel_id)));
drop policy if exists randai_memory_admin_manage on public.randai_memory;
create policy randai_memory_manage_all on public.randai_memory for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
drop policy if exists randai_procedures_admin_all on public.randai_procedures;
create policy randai_procedures_manage_all on public.randai_procedures for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
drop policy if exists randai_sensor_bindings_admin_all on public.randai_sensor_bindings;
create policy randai_sensor_bindings_manage_all on public.randai_sensor_bindings for all to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));