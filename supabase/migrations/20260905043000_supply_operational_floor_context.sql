-- Contesto operativo condiviso Area + Piano per Rifornimenti e Housekeeping.
-- La struttura fisica è separata dalle richieste e non dipende dal planning giornaliero.
create table if not exists public.hotel_floor_contexts (
  hotel_id text not null,
  area_code text not null,
  area_label text not null,
  floor_number integer not null,
  floor_label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hotel_id, area_code, floor_number),
  check (length(btrim(area_code)) between 1 and 32),
  check (length(btrim(area_label)) between 1 and 80),
  check (floor_number between -5 and 100),
  check (length(btrim(floor_label)) between 1 and 40)
);

alter table public.hotel_floor_contexts enable row level security;
revoke all on public.hotel_floor_contexts from anon, authenticated;

insert into public.hotel_floor_contexts(hotel_id,area_code,area_label,floor_number,floor_label,active,sort_order)
values
  ('hotelgio','jazz','Jazz',1,'Piano 1',true,11),
  ('hotelgio','jazz','Jazz',2,'Piano 2',true,12),
  ('hotelgio','jazz','Jazz',3,'Piano 3',true,13),
  ('hotelgio','jazz','Jazz',4,'Piano 4',true,14),
  ('hotelgio','wine','Wine',1,'Piano 1',true,21),
  ('hotelgio','wine','Wine',2,'Piano 2',true,22),
  ('hotelgio','wine','Wine',3,'Piano 3',true,23),
  ('hotelgio','wine','Wine',4,'Piano 4',true,24)
on conflict(hotel_id,area_code,floor_number) do update
set area_label=excluded.area_label,floor_label=excluded.floor_label,active=excluded.active,sort_order=excluded.sort_order,updated_at=now();

create or replace function public.operational_list_floor_contexts(p_hotel_id text)
returns table(area_code text,area_label text,floor_number integer,floor_label text,sort_order integer)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (
    public.has_app_permission(p_hotel_id,'supplies','view')
    or public.has_app_permission(p_hotel_id,'housekeeping','view')
  ) then raise exception 'PERMISSION_DENIED'; end if;
  return query
    select c.area_code,c.area_label,c.floor_number,c.floor_label,c.sort_order
    from public.hotel_floor_contexts c
    where c.hotel_id=p_hotel_id and c.active
    order by c.sort_order,c.area_label,c.floor_number;
end $$;
revoke all on function public.operational_list_floor_contexts(text) from public,anon;
grant execute on function public.operational_list_floor_contexts(text) to authenticated;

alter table public.supply_requests
  add column if not exists area_code text,
  add column if not exists area_label text,
  add column if not exists floor_number integer,
  add column if not exists floor_label text;

alter table public.supply_requests
  drop constraint if exists supply_requests_area_code_check,
  drop constraint if exists supply_requests_area_label_check,
  drop constraint if exists supply_requests_floor_number_check,
  drop constraint if exists supply_requests_floor_label_check;
alter table public.supply_requests
  add constraint supply_requests_area_code_check check(area_code is null or length(btrim(area_code)) between 1 and 32),
  add constraint supply_requests_area_label_check check(area_label is null or length(btrim(area_label)) between 1 and 80),
  add constraint supply_requests_floor_number_check check(floor_number is null or floor_number between -5 and 100),
  add constraint supply_requests_floor_label_check check(floor_label is null or length(btrim(floor_label)) between 1 and 40);
create index if not exists supply_requests_hotel_floor_open_idx
  on public.supply_requests(hotel_id,area_code,floor_number,created_at desc)
  where completed_at is null;

create or replace function public.supply_create_request_v2(
  p_hotel_id text,
  p_product_ids uuid[],
  p_note text default null,
  p_area_code text default null,
  p_floor_number integer default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_request uuid; v_name text; v_count int; v_is_housekeeping boolean;
  v_area_code text; v_area_label text; v_floor_number integer; v_floor_label text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_app_permission(p_hotel_id,'supplies','create') then raise exception 'PERMISSION_DENIED'; end if;
  v_is_housekeeping := public.has_hotel_role(p_hotel_id,array['Governante','Capo Governante']);
  if v_is_housekeeping and not public.current_profile_has_phone() then raise exception 'PHONE_REQUIRED'; end if;
  if coalesce(array_length(p_product_ids,1),0)=0 then raise exception 'SUPPLY_PRODUCTS_REQUIRED'; end if;

  if p_area_code is not null or p_floor_number is not null then
    if p_area_code is null or p_floor_number is null then raise exception 'SUPPLY_FLOOR_CONTEXT_INCOMPLETE'; end if;
    select c.area_code,c.area_label,c.floor_number,c.floor_label
      into v_area_code,v_area_label,v_floor_number,v_floor_label
    from public.hotel_floor_contexts c
    where c.hotel_id=p_hotel_id and c.active
      and c.area_code=lower(btrim(p_area_code)) and c.floor_number=p_floor_number;
    if v_area_code is null then raise exception 'SUPPLY_FLOOR_CONTEXT_INVALID'; end if;
  elsif exists(select 1 from public.hotel_floor_contexts c where c.hotel_id=p_hotel_id and c.active) then
    raise exception 'SUPPLY_FLOOR_CONTEXT_REQUIRED';
  end if;

  select coalesce(display_name,'Governante') into v_name from public.profiles where auth_user_id=auth.uid();
  select count(*) into v_count from public.supply_products where hotel_id=p_hotel_id and active and id=any(p_product_ids);
  if v_count<>(select count(distinct x) from unnest(p_product_ids)x) then raise exception 'SUPPLY_PRODUCT_INVALID'; end if;

  insert into public.supply_requests(
    hotel_id,requested_by,requested_by_name,note,area_code,area_label,floor_number,floor_label
  ) values(
    p_hotel_id,auth.uid(),coalesce(v_name,'Governante'),nullif(btrim(p_note),''),
    v_area_code,v_area_label,v_floor_number,v_floor_label
  ) returning id into v_request;

  insert into public.supply_request_items(hotel_id,request_id,product_id,product_name,category)
  select p_hotel_id,v_request,p.id,p.name,p.category
  from public.supply_products p
  where p.hotel_id=p_hotel_id and p.active
    and p.id in(select distinct x from unnest(p_product_ids)x);
  return v_request;
end $$;

revoke all on function public.supply_create_request_v2(text,uuid[],text,text,integer) from public,anon;
grant execute on function public.supply_create_request_v2(text,uuid[],text,text,integer) to authenticated;

-- Compatibilità con client installati/cache: la RPC v1 resta disponibile.
-- I nuovi client usano v2 e, dove esistono contesti configurati, il piano è obbligatorio.
