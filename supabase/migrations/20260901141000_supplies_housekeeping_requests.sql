-- Rifornimenti interni Housekeeping -> Manutenzione/Facchini.
-- Catalogo vuoto per hotel, categorie fisse minibar/consumo, esiti pending/delivered/missing.
create table if not exists public.supply_products (
  id uuid primary key default gen_random_uuid(), hotel_id text not null,
  category text not null check (category in ('minibar','consumo')),
  name text not null check (length(btrim(name)) between 1 and 120), active boolean not null default true,
  sort_order integer not null default 0, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (hotel_id,id)
);
create unique index if not exists supply_products_hotel_name_uq on public.supply_products(hotel_id,lower(name));
create index if not exists supply_products_hotel_active_idx on public.supply_products(hotel_id,active,category,sort_order,name);
create table if not exists public.supply_requests (
  id uuid primary key default gen_random_uuid(), hotel_id text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_by_name text not null default 'Governante', note text,
  created_at timestamptz not null default now(), completed_at timestamptz, unique(hotel_id,id)
);
create index if not exists supply_requests_hotel_created_idx on public.supply_requests(hotel_id,created_at desc);
create table if not exists public.supply_request_items (
  id uuid primary key default gen_random_uuid(), hotel_id text not null, request_id uuid not null, product_id uuid not null,
  product_name text not null, category text not null check(category in ('minibar','consumo')),
  status text not null default 'pending' check(status in ('pending','delivered','missing')),
  resolved_by uuid references auth.users(id) on delete set null, resolved_by_name text, resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint supply_request_items_request_fk foreign key(hotel_id,request_id) references public.supply_requests(hotel_id,id) on delete cascade,
  constraint supply_request_items_product_fk foreign key(hotel_id,product_id) references public.supply_products(hotel_id,id) on delete restrict,
  unique(request_id,product_id)
);
create index if not exists supply_request_items_request_idx on public.supply_request_items(request_id,status);
create index if not exists supply_request_items_hotel_status_idx on public.supply_request_items(hotel_id,status,created_at desc);
alter table public.supply_products enable row level security;
alter table public.supply_requests enable row level security;
alter table public.supply_request_items enable row level security;
create policy supply_products_read on public.supply_products for select to authenticated using(public.has_app_permission(hotel_id,'supplies','view'));
create policy supply_products_manage_insert on public.supply_products for insert to authenticated with check(public.has_app_permission(hotel_id,'supplies','manage'));
create policy supply_products_manage_update on public.supply_products for update to authenticated using(public.has_app_permission(hotel_id,'supplies','manage')) with check(public.has_app_permission(hotel_id,'supplies','manage'));
create policy supply_products_manage_delete on public.supply_products for delete to authenticated using(public.has_app_permission(hotel_id,'supplies','manage'));
create policy supply_requests_read on public.supply_requests for select to authenticated using(public.has_app_permission(hotel_id,'supplies','view'));
create policy supply_request_items_read on public.supply_request_items for select to authenticated using(public.has_app_permission(hotel_id,'supplies','view'));
revoke insert,update,delete on public.supply_requests from authenticated;
revoke insert,update,delete on public.supply_request_items from authenticated;
grant select on public.supply_products,public.supply_requests,public.supply_request_items to authenticated;
grant insert,update,delete on public.supply_products to authenticated;
create or replace function public.supply_create_request(p_hotel_id text,p_product_ids uuid[],p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_request uuid;v_name text;v_count int;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_app_permission(p_hotel_id,'supplies','create') then raise exception 'PERMISSION_DENIED'; end if;
 if coalesce(array_length(p_product_ids,1),0)=0 then raise exception 'SUPPLY_PRODUCTS_REQUIRED'; end if;
 select coalesce(display_name,'Governante') into v_name from public.profiles where auth_user_id=auth.uid();
 select count(*) into v_count from public.supply_products where hotel_id=p_hotel_id and active and id=any(p_product_ids);
 if v_count<>(select count(distinct x) from unnest(p_product_ids)x) then raise exception 'SUPPLY_PRODUCT_INVALID'; end if;
 insert into public.supply_requests(hotel_id,requested_by,requested_by_name,note) values(p_hotel_id,auth.uid(),coalesce(v_name,'Governante'),nullif(btrim(p_note),'')) returning id into v_request;
 insert into public.supply_request_items(hotel_id,request_id,product_id,product_name,category)
 select p_hotel_id,v_request,p.id,p.name,p.category from public.supply_products p where p.hotel_id=p_hotel_id and p.active and p.id in(select distinct x from unnest(p_product_ids)x);
 return v_request;
end $$;
create or replace function public.supply_resolve_item(p_item_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_hotel text;v_request uuid;v_name text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_status not in('delivered','missing') then raise exception 'SUPPLY_STATUS_INVALID'; end if;
 select hotel_id,request_id into v_hotel,v_request from public.supply_request_items where id=p_item_id for update;
 if v_hotel is null then raise exception 'SUPPLY_ITEM_NOT_FOUND'; end if;
 if not public.has_app_permission(v_hotel,'supplies','complete') then raise exception 'PERMISSION_DENIED'; end if;
 select coalesce(display_name,'Manutentore') into v_name from public.profiles where auth_user_id=auth.uid();
 update public.supply_request_items set status=p_status,resolved_by=auth.uid(),resolved_by_name=coalesce(v_name,'Manutentore'),resolved_at=now() where id=p_item_id;
 update public.supply_requests r set completed_at=case when not exists(select 1 from public.supply_request_items i where i.request_id=v_request and i.status='pending') then coalesce(r.completed_at,now()) else null end where r.id=v_request;
end $$;
revoke all on function public.supply_create_request(text,uuid[],text) from public,anon;
revoke all on function public.supply_resolve_item(uuid,text) from public,anon;
grant execute on function public.supply_create_request(text,uuid[],text) to authenticated;
grant execute on function public.supply_resolve_item(uuid,text) to authenticated;
insert into public.role_permissions(role,module,action,allowed,updated_at) values
('Governante','supplies','view',true,now()),('Governante','supplies','create',true,now()),
('Capo Governante','supplies','view',true,now()),('Capo Governante','supplies','create',true,now()),
('manutentore','supplies','view',true,now()),('manutentore','supplies','complete',true,now()),
('admin','supplies','view',true,now()),('admin','supplies','create',true,now()),('admin','supplies','complete',true,now()),('admin','supplies','manage',true,now())
on conflict(role,module,action) do update set allowed=excluded.allowed,updated_at=excluded.updated_at;