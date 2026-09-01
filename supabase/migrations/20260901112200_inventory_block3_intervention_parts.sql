create unique index if not exists interventi_hotel_id_id_uidx on public.interventi(hotel_id,id);

create table if not exists public.inventory_intervention_parts (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  intervention_id uuid not null,
  item_id uuid,
  requested_name text,
  quantity numeric not null default 1 check (quantity > 0),
  status text not null default 'requested' check (status in ('requested','reserved','consumed','released','cancelled')),
  serial_unit_id uuid,
  note text,
  movement_id uuid references public.inventory_movements(id) on delete restrict,
  created_by uuid default auth.uid(),
  reserved_by uuid,
  consumed_by uuid,
  released_by uuid,
  created_at timestamptz not null default now(),
  reserved_at timestamptz,
  consumed_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint inventory_intervention_parts_intervention_fk foreign key (hotel_id,intervention_id) references public.interventi(hotel_id,id) on delete restrict,
  constraint inventory_intervention_parts_item_fk foreign key (hotel_id,item_id) references public.inventory_items(hotel_id,id) on delete restrict,
  constraint inventory_intervention_parts_serial_fk foreign key (serial_unit_id) references public.inventory_serial_units(id) on delete restrict,
  constraint inventory_intervention_parts_item_or_name check (item_id is not null or nullif(btrim(requested_name),'') is not null),
  constraint inventory_intervention_parts_serial_qty check (serial_unit_id is null or quantity = 1)
);

create index if not exists inventory_intervention_parts_intervention_idx on public.inventory_intervention_parts(hotel_id,intervention_id,created_at);
create index if not exists inventory_intervention_parts_item_status_idx on public.inventory_intervention_parts(hotel_id,item_id,status) where item_id is not null;
create index if not exists inventory_intervention_parts_serial_idx on public.inventory_intervention_parts(serial_unit_id) where serial_unit_id is not null;

alter table public.inventory_intervention_parts enable row level security;
revoke insert, update, delete on public.inventory_intervention_parts from anon, authenticated;
grant select on public.inventory_intervention_parts to authenticated;

drop policy if exists inventory_intervention_parts_select on public.inventory_intervention_parts;
create policy inventory_intervention_parts_select on public.inventory_intervention_parts for select to authenticated using (
  public.has_app_permission(hotel_id,'interventions','view') or public.has_app_permission(hotel_id,'inventory','view')
);

create or replace view public.inventory_available_stock with (security_invoker=true) as
select i.id as item_id,
       i.hotel_id,
       i.name,
       i.unit,
       i.quantity,
       coalesce(r.reserved_quantity,0::numeric) as reserved_quantity,
       greatest(i.quantity-coalesce(r.reserved_quantity,0::numeric),0::numeric) as available_quantity
from public.inventory_items i
left join (
  select hotel_id,item_id,sum(quantity)::numeric as reserved_quantity
  from public.inventory_intervention_parts
  where status='reserved' and item_id is not null
  group by hotel_id,item_id
) r on r.hotel_id=i.hotel_id and r.item_id=i.id
where i.active=true;
grant select on public.inventory_available_stock to authenticated;

create or replace function public.inventory_request_intervention_part(
  p_intervention_id uuid,
  p_item_id uuid default null,
  p_requested_name text default null,
  p_quantity numeric default 1,
  p_note text default null,
  p_reserve boolean default true,
  p_serial_unit_id uuid default null
) returns public.inventory_intervention_parts
language plpgsql security definer set search_path=public as $$
declare
  v_intervention public.interventi%rowtype;
  v_item public.inventory_items%rowtype;
  v_available numeric;
  v_status text := 'requested';
  v_row public.inventory_intervention_parts%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  select * into v_intervention from public.interventi where id=p_intervention_id and deleted_at is null for update;
  if not found or coalesce(v_intervention.sezione,'intervento') <> 'intervento' then raise exception 'INTERVENTION_NOT_FOUND'; end if;
  if not (public.has_app_permission(v_intervention.hotel_id,'interventions','edit') or public.has_app_permission(v_intervention.hotel_id,'interventions','complete') or public.has_app_permission(v_intervention.hotel_id,'inventory','edit')) then raise exception 'PERMISSION_DENIED'; end if;
  if p_item_id is null and nullif(btrim(coalesce(p_requested_name,'')),'') is null then raise exception 'PART_REQUIRED'; end if;
  if p_item_id is not null then
    select * into v_item from public.inventory_items where id=p_item_id and hotel_id=v_intervention.hotel_id and active=true for update;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
    if p_serial_unit_id is not null then
      if p_quantity <> 1 then raise exception 'SERIAL_QUANTITY_MUST_BE_ONE'; end if;
      if not exists(select 1 from public.inventory_serial_units s where s.id=p_serial_unit_id and s.hotel_id=v_intervention.hotel_id and s.item_id=p_item_id and s.active=true and s.status='available') then raise exception 'SERIAL_NOT_AVAILABLE'; end if;
      if exists(select 1 from public.inventory_intervention_parts x where x.serial_unit_id=p_serial_unit_id and x.status='reserved') then raise exception 'SERIAL_ALREADY_RESERVED'; end if;
    end if;
    if p_reserve then
      select greatest(v_item.quantity-coalesce(sum(x.quantity) filter (where x.status='reserved'),0),0)
      into v_available
      from public.inventory_intervention_parts x
      where x.hotel_id=v_intervention.hotel_id and x.item_id=p_item_id;
      if v_available < p_quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;
      v_status := 'reserved';
    end if;
  end if;
  insert into public.inventory_intervention_parts(hotel_id,intervention_id,item_id,requested_name,quantity,status,serial_unit_id,note,reserved_by,reserved_at)
  values(v_intervention.hotel_id,p_intervention_id,p_item_id,nullif(btrim(coalesce(p_requested_name,'')),''),p_quantity,v_status,p_serial_unit_id,nullif(btrim(coalesce(p_note,'')),''),case when v_status='reserved' then auth.uid() else null end,case when v_status='reserved' then now() else null end)
  returning * into v_row;
  if v_status='reserved' and p_serial_unit_id is not null then update public.inventory_serial_units set status='in_use', updated_at=now() where id=p_serial_unit_id; end if;
  return v_row;
end $$;

create or replace function public.inventory_reserve_intervention_part(p_part_id uuid,p_item_id uuid default null,p_serial_unit_id uuid default null)
returns public.inventory_intervention_parts
language plpgsql security definer set search_path=public as $$
declare
  v_row public.inventory_intervention_parts%rowtype;
  v_item public.inventory_items%rowtype;
  v_available numeric;
  v_effective_item uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.inventory_intervention_parts where id=p_part_id for update;
  if not found or v_row.status not in ('requested','released') then raise exception 'PART_NOT_RESERVABLE'; end if;
  if not (public.has_app_permission(v_row.hotel_id,'interventions','edit') or public.has_app_permission(v_row.hotel_id,'interventions','complete') or public.has_app_permission(v_row.hotel_id,'inventory','edit')) then raise exception 'PERMISSION_DENIED'; end if;
  v_effective_item:=coalesce(p_item_id,v_row.item_id);
  if v_effective_item is null then raise exception 'ITEM_REQUIRED'; end if;
  select * into v_item from public.inventory_items where id=v_effective_item and hotel_id=v_row.hotel_id and active=true for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  select greatest(v_item.quantity-coalesce(sum(x.quantity) filter(where x.status='reserved' and x.id<>v_row.id),0),0)
  into v_available from public.inventory_intervention_parts x where x.hotel_id=v_row.hotel_id and x.item_id=v_effective_item;
  if v_available < v_row.quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;
  if p_serial_unit_id is not null then
    if v_row.quantity<>1 then raise exception 'SERIAL_QUANTITY_MUST_BE_ONE'; end if;
    if not exists(select 1 from public.inventory_serial_units s where s.id=p_serial_unit_id and s.hotel_id=v_row.hotel_id and s.item_id=v_effective_item and s.active=true and s.status='available') then raise exception 'SERIAL_NOT_AVAILABLE'; end if;
    if exists(select 1 from public.inventory_intervention_parts x where x.serial_unit_id=p_serial_unit_id and x.status='reserved' and x.id<>v_row.id) then raise exception 'SERIAL_ALREADY_RESERVED'; end if;
  end if;
  update public.inventory_intervention_parts set item_id=v_effective_item, serial_unit_id=coalesce(p_serial_unit_id,serial_unit_id), status='reserved', reserved_by=auth.uid(), reserved_at=now(), released_by=null, released_at=null, updated_at=now() where id=v_row.id returning * into v_row;
  if p_serial_unit_id is not null then update public.inventory_serial_units set status='in_use',updated_at=now() where id=p_serial_unit_id; end if;
  return v_row;
end $$;

create or replace function public.inventory_release_intervention_part(p_part_id uuid,p_cancel boolean default false)
returns public.inventory_intervention_parts
language plpgsql security definer set search_path=public as $$
declare v_row public.inventory_intervention_parts%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.inventory_intervention_parts where id=p_part_id for update;
  if not found or v_row.status not in ('requested','reserved','released') then raise exception 'PART_NOT_RELEASABLE'; end if;
  if not (public.has_app_permission(v_row.hotel_id,'interventions','edit') or public.has_app_permission(v_row.hotel_id,'interventions','complete') or public.has_app_permission(v_row.hotel_id,'inventory','edit')) then raise exception 'PERMISSION_DENIED'; end if;
  if v_row.serial_unit_id is not null and v_row.status='reserved' then update public.inventory_serial_units set status='available',updated_at=now() where id=v_row.serial_unit_id and status='in_use'; end if;
  update public.inventory_intervention_parts set status=case when p_cancel then 'cancelled' else 'released' end,released_by=auth.uid(),released_at=now(),updated_at=now() where id=v_row.id returning * into v_row;
  return v_row;
end $$;

create or replace function public.inventory_consume_intervention_part(p_part_id uuid)
returns public.inventory_intervention_parts
language plpgsql security definer set search_path=public as $$
declare
  v_row public.inventory_intervention_parts%rowtype;
  v_item public.inventory_items%rowtype;
  v_before numeric;
  v_after numeric;
  v_movement uuid;
  v_names text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.inventory_intervention_parts where id=p_part_id for update;
  if not found or v_row.status <> 'reserved' or v_row.item_id is null then raise exception 'PART_NOT_RESERVED'; end if;
  if not (public.has_app_permission(v_row.hotel_id,'interventions','complete') or public.has_app_permission(v_row.hotel_id,'inventory','edit')) then raise exception 'PERMISSION_DENIED'; end if;
  select * into v_item from public.inventory_items where id=v_row.item_id and hotel_id=v_row.hotel_id and active=true for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  if v_item.quantity < v_row.quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
  v_before:=v_item.quantity; v_after:=v_before-v_row.quantity;
  update public.inventory_items set quantity=v_after,updated_at=now() where id=v_item.id;
  insert into public.inventory_movements(hotel_id,item_id,delta,quantity_before,quantity_after,movement_type,location_id,reason_code,reference_type,reference_id,note,metadata,created_by)
  values(v_row.hotel_id,v_row.item_id,-v_row.quantity,v_before,v_after,'consumo',v_item.default_location_id,'intervention_part','intervention',v_row.intervention_id::text,coalesce(v_row.note,'Ricambio usato in intervento'),jsonb_build_object('intervention_part_id',v_row.id,'serial_unit_id',v_row.serial_unit_id),auth.uid()) returning id into v_movement;
  update public.inventory_intervention_parts set status='consumed',movement_id=v_movement,consumed_by=auth.uid(),consumed_at=now(),updated_at=now() where id=v_row.id returning * into v_row;
  if v_row.serial_unit_id is not null then update public.inventory_serial_units set status='in_use',updated_at=now() where id=v_row.serial_unit_id; end if;
  select string_agg(distinct i.name,', ' order by i.name) into v_names from public.inventory_intervention_parts p join public.inventory_items i on i.id=p.item_id where p.intervention_id=v_row.intervention_id and p.hotel_id=v_row.hotel_id and p.status='consumed';
  update public.interventi set pezzo_sostituito=v_names,pezzo_sostituito_da=coalesce(pezzo_sostituito_da,(select name from public.profiles where auth_user_id=auth.uid() limit 1)),pezzo_sostituito_il=coalesce(pezzo_sostituito_il,now()) where id=v_row.intervention_id and hotel_id=v_row.hotel_id;
  return v_row;
end $$;

create or replace function public.inventory_guard_intervention_completion()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.stato='done' and coalesce(old.stato,'')<>'done' and exists(select 1 from public.inventory_intervention_parts p where p.hotel_id=new.hotel_id and p.intervention_id=new.id and p.status in ('requested','reserved')) then
    raise exception 'INTERVENTION_PARTS_PENDING';
  end if;
  return new;
end $$;
drop trigger if exists trg_inventory_guard_intervention_completion on public.interventi;
create trigger trg_inventory_guard_intervention_completion before update of stato on public.interventi for each row execute function public.inventory_guard_intervention_completion();

revoke all on function public.inventory_request_intervention_part(uuid,uuid,text,numeric,text,boolean,uuid) from public,anon;
revoke all on function public.inventory_reserve_intervention_part(uuid,uuid,uuid) from public,anon;
revoke all on function public.inventory_release_intervention_part(uuid,boolean) from public,anon;
revoke all on function public.inventory_consume_intervention_part(uuid) from public,anon;
grant execute on function public.inventory_request_intervention_part(uuid,uuid,text,numeric,text,boolean,uuid) to authenticated;
grant execute on function public.inventory_reserve_intervention_part(uuid,uuid,uuid) to authenticated;
grant execute on function public.inventory_release_intervention_part(uuid,boolean) to authenticated;
grant execute on function public.inventory_consume_intervention_part(uuid) to authenticated;
