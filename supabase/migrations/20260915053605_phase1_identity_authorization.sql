-- Phase 1: make RandGuide reads explicit in the central permission matrix.
-- Existing members retain approved read access; administrators/RandAI retain authoring access.

insert into public.role_permissions(role,module,action,allowed,updated_at)
select roles.role, 'procedures', actions.action,
  case
    when actions.action = 'view' then true
    when roles.role in ('admin','RandAI') and actions.action in ('create','edit','delete','manage') then true
    else false
  end,
  now()
from (select distinct role from public.hotel_memberships where role is not null) roles
cross join (values ('view'),('create'),('edit'),('assign'),('take_charge'),('complete'),('delete'),('manage')) actions(action)
on conflict (role,module,action) do update
set allowed=excluded.allowed,
    updated_at=excluded.updated_at;

drop policy if exists randai_procedures_select on public.randai_procedures;
create policy randai_procedures_select on public.randai_procedures
  for select to authenticated
  using (
    public.can_manage_randai_hotel(hotel_id)
    or (status='approved' and public.has_app_permission(hotel_id,'procedures','view'))
  );

drop policy if exists randai_documents_select on public.randai_documents;
create policy randai_documents_select on public.randai_documents
  for select to authenticated
  using (
    public.can_manage_randai_hotel(hotel_id)
    or (status='approved' and public.has_app_permission(hotel_id,'procedures','view'))
  );

drop policy if exists randai_equipment_select on public.randai_equipment;
create policy randai_equipment_select on public.randai_equipment
  for select to authenticated
  using (
    public.can_manage_randai_hotel(hotel_id)
    or (active and public.has_app_permission(hotel_id,'procedures','view'))
  );

drop policy if exists randguide_versions_select on public.randguide_procedure_versions;
create policy randguide_versions_select on public.randguide_procedure_versions
  for select to authenticated
  using (
    public.can_manage_randai_hotel(hotel_id)
    or (
      public.has_app_permission(hotel_id,'procedures','view')
      and exists (
        select 1
        from public.randai_procedures p
        where p.id=procedure_id
          and p.hotel_id=randguide_procedure_versions.hotel_id
          and p.status='approved'
      )
    )
  );

drop policy if exists randguide_links_select on public.randguide_links;
create policy randguide_links_select on public.randguide_links
  for select to authenticated
  using (
    public.can_manage_randai_hotel(hotel_id)
    or (
      public.has_app_permission(hotel_id,'procedures','view')
      and exists (
        select 1
        from public.randai_procedures p
        where p.hotel_id=randguide_links.hotel_id
          and p.status='approved'
          and (
            (randguide_links.from_type='procedure' and p.id=randguide_links.from_id)
            or (randguide_links.to_type='procedure' and p.id=randguide_links.to_id)
          )
      )
      and not exists (
        select 1
        from public.randai_procedures p
        where p.hotel_id=randguide_links.hotel_id
          and p.status<>'approved'
          and (
            (randguide_links.from_type='procedure' and p.id=randguide_links.from_id)
            or (randguide_links.to_type='procedure' and p.id=randguide_links.to_id)
          )
      )
    )
  );

revoke execute on function public.has_app_permission(text,text,text) from public, anon;
grant execute on function public.has_app_permission(text,text,text) to authenticated, service_role;
