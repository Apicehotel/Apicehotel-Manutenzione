create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  name text not null,
  category text not null default 'Varie',
  unit text not null default 'pz',
  location text,
  sku text,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  min_quantity numeric(12,3) not null default 0 check (min_quantity >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_items_hotel_active_idx on public.inventory_items(hotel_id, active);
create index if not exists inventory_items_hotel_category_idx on public.inventory_items(hotel_id, category);
create index if not exists inventory_items_low_stock_idx on public.inventory_items(hotel_id, quantity, min_quantity) where active;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  delta numeric(12,3) not null check (delta <> 0),
  quantity_before numeric(12,3) not null,
  quantity_after numeric(12,3) not null check (quantity_after >= 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_created_idx on public.inventory_movements(item_id, created_at desc);
create index if not exists inventory_movements_hotel_created_idx on public.inventory_movements(hotel_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items for select to authenticated using (public.has_app_permission(hotel_id, 'inventory', 'view'));
drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert on public.inventory_items for insert to authenticated with check (public.has_app_permission(hotel_id, 'inventory', 'create'));
drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update on public.inventory_items for update to authenticated using (public.has_app_permission(hotel_id, 'inventory', 'edit')) with check (public.has_app_permission(hotel_id, 'inventory', 'edit'));
drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete on public.inventory_items for delete to authenticated using (public.has_app_permission(hotel_id, 'inventory', 'delete'));
drop policy if exists inventory_movements_select on public.inventory_movements;
create policy inventory_movements_select on public.inventory_movements for select to authenticated using (public.has_app_permission(hotel_id, 'inventory', 'view'));

create or replace function public.inventory_adjust_stock(p_item_id uuid, p_delta numeric, p_note text default null)
returns public.inventory_items language plpgsql security definer set search_path = public as $$
declare v_item public.inventory_items; v_before numeric(12,3); v_after numeric(12,3);
begin
  if p_delta is null or p_delta = 0 then raise exception 'La quantità del movimento deve essere diversa da zero'; end if;
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Articolo non trovato'; end if;
  if not public.has_app_permission(v_item.hotel_id, 'inventory', 'edit') then raise exception 'Permesso magazzino non sufficiente'; end if;
  v_before := v_item.quantity; v_after := v_before + p_delta;
  if v_after < 0 then raise exception 'Giacenza insufficiente'; end if;
  update public.inventory_items set quantity = v_after, updated_at = now() where id = p_item_id returning * into v_item;
  insert into public.inventory_movements(hotel_id,item_id,delta,quantity_before,quantity_after,note,created_by)
  values(v_item.hotel_id,v_item.id,p_delta,v_before,v_after,nullif(trim(p_note),''),auth.uid());
  return v_item;
end; $$;
revoke all on function public.inventory_adjust_stock(uuid,numeric,text) from public;
grant execute on function public.inventory_adjust_stock(uuid,numeric,text) to authenticated;

insert into public.role_permissions(role,module,action,allowed)
select role,'inventory',action,true from (values ('admin'),('RandAI'),('Direzione'),('Direttore Centro Congressi')) r(role)
cross join (values ('view'),('create'),('edit'),('delete'),('manage')) a(action)
on conflict (role,module,action) do update set allowed=excluded.allowed,updated_at=now();
insert into public.role_permissions(role,module,action,allowed)
select role,'inventory',action,true from (values ('manutentore'),('Supremo')) r(role)
cross join (values ('view'),('create'),('edit')) a(action)
on conflict (role,module,action) do update set allowed=excluded.allowed,updated_at=now();
