-- Governanti: privacy per-account + numero personale obbligatorio.
-- Le Governanti/Capo Governanti vedono solo segnalazioni e rifornimenti creati dal proprio auth.uid().
-- Il telefono identifica un profilo operativo valido, ma la proprietà resta sempre sull'UUID autenticato.
create or replace function public.current_profile_has_phone()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
      and nullif(btrim(coalesce(p.phone,'')), '') is not null
  );
$$;

revoke all on function public.current_profile_has_phone() from public, anon;
grant execute on function public.current_profile_has_phone() to authenticated;

drop policy if exists segnalazioni_permission_select on public.segnalazioni;
create policy segnalazioni_permission_select
on public.segnalazioni
for select
to authenticated
using (
  public.has_app_permission(hotel_id,'issues','view')
  and deleted_at is null
  and (
    not public.has_hotel_role(hotel_id, array['Governante','Capo Governante'])
    or (
      created_by_user_id = (select auth.uid())
      and public.current_profile_has_phone()
    )
  )
);

drop policy if exists segnalazioni_permission_insert on public.segnalazioni;
create policy segnalazioni_permission_insert
on public.segnalazioni
for insert
to authenticated
with check (
  public.has_app_permission(hotel_id,'issues','create')
  and (
    not public.has_hotel_role(hotel_id, array['Governante','Capo Governante'])
    or public.current_profile_has_phone()
  )
);

drop policy if exists supply_requests_read on public.supply_requests;
create policy supply_requests_read
on public.supply_requests
for select
to authenticated
using (
  public.has_app_permission(hotel_id,'supplies','view')
  and (
    not public.has_hotel_role(hotel_id, array['Governante','Capo Governante'])
    or (
      requested_by = (select auth.uid())
      and public.current_profile_has_phone()
    )
  )
);

drop policy if exists supply_request_items_read on public.supply_request_items;
create policy supply_request_items_read
on public.supply_request_items
for select
to authenticated
using (
  public.has_app_permission(hotel_id,'supplies','view')
  and (
    not public.has_hotel_role(hotel_id, array['Governante','Capo Governante'])
    or (
      public.current_profile_has_phone()
      and exists (
        select 1
        from public.supply_requests r
        where r.id = supply_request_items.request_id
          and r.hotel_id = supply_request_items.hotel_id
          and r.requested_by = (select auth.uid())
      )
    )
  )
);

create or replace function public.supply_create_request(p_hotel_id text,p_product_ids uuid[],p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_request uuid;v_name text;v_count int;v_is_housekeeping boolean;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_app_permission(p_hotel_id,'supplies','create') then raise exception 'PERMISSION_DENIED'; end if;
 v_is_housekeeping := public.has_hotel_role(p_hotel_id,array['Governante','Capo Governante']);
 if v_is_housekeeping and not public.current_profile_has_phone() then raise exception 'PHONE_REQUIRED'; end if;
 if coalesce(array_length(p_product_ids,1),0)=0 then raise exception 'SUPPLY_PRODUCTS_REQUIRED'; end if;
 select coalesce(display_name,'Governante') into v_name from public.profiles where auth_user_id=auth.uid();
 select count(*) into v_count from public.supply_products where hotel_id=p_hotel_id and active and id=any(p_product_ids);
 if v_count<>(select count(distinct x) from unnest(p_product_ids)x) then raise exception 'SUPPLY_PRODUCT_INVALID'; end if;
 insert into public.supply_requests(hotel_id,requested_by,requested_by_name,note) values(p_hotel_id,auth.uid(),coalesce(v_name,'Governante'),nullif(btrim(p_note),'')) returning id into v_request;
 insert into public.supply_request_items(hotel_id,request_id,product_id,product_name,category)
 select p_hotel_id,v_request,p.id,p.name,p.category from public.supply_products p where p.hotel_id=p_hotel_id and p.active and p.id in(select distinct x from unnest(p_product_ids)x);
 return v_request;
end $$;

revoke all on function public.supply_create_request(text,uuid[],text) from public,anon;
grant execute on function public.supply_create_request(text,uuid[],text) to authenticated;
