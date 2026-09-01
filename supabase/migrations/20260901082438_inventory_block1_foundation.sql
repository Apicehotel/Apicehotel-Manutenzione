-- RandApp Magazzino — Blocco 1
-- Foundation autonoma: categorie/ubicazioni gerarchiche, catalogo ricambi,
-- vocabolario guasti, ledger immutabile e policy di riordino.

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  parent_id uuid,
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  description text,
  icon text,
  color text,
  attribute_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(attribute_schema) = 'array'),
  synonyms text[] not null default '{}'::text[],
  fault_terms text[] not null default '{}'::text[],
  default_action text check (default_action is null or default_action in ('sostituzione','riparazione','pulizia','regolazione','verifica')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_categories_hotel_code_key unique (hotel_id, code),
  constraint inventory_categories_hotel_id_id_key unique (hotel_id, id)
);

alter table public.inventory_categories drop constraint if exists inventory_categories_parent_hotel_fkey;
alter table public.inventory_categories add constraint inventory_categories_parent_hotel_fkey
  foreign key (hotel_id, parent_id) references public.inventory_categories(hotel_id, id) on delete restrict;
create index if not exists inventory_categories_hotel_parent_idx
  on public.inventory_categories(hotel_id, parent_id, active, sort_order, name);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete cascade,
  parent_id uuid,
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  kind text not null default 'area' check (kind in ('magazzino','zona','scaffale','ripiano','cassetto','area')),
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_locations_hotel_code_key unique (hotel_id, code),
  constraint inventory_locations_hotel_id_id_key unique (hotel_id, id)
);

alter table public.inventory_locations drop constraint if exists inventory_locations_parent_hotel_fkey;
alter table public.inventory_locations add constraint inventory_locations_parent_hotel_fkey
  foreign key (hotel_id, parent_id) references public.inventory_locations(hotel_id, id) on delete restrict;
create index if not exists inventory_locations_hotel_parent_idx
  on public.inventory_locations(hotel_id, parent_id, active, sort_order, name);

alter table public.inventory_items
  add column if not exists category_id uuid,
  add column if not exists item_type text not null default 'consumabile',
  add column if not exists parent_item_id uuid,
  add column if not exists variant_label text,
  add column if not exists barcode text,
  add column if not exists manufacturer text,
  add column if not exists model text,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists synonyms text[] not null default '{}'::text[],
  add column if not exists ideal_quantity numeric(12,3) not null default 0,
  add column if not exists reorder_quantity numeric(12,3) not null default 0,
  add column if not exists default_location_id uuid;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check,
  drop constraint if exists inventory_items_attributes_object_check,
  drop constraint if exists inventory_items_ideal_quantity_check,
  drop constraint if exists inventory_items_reorder_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_item_type_check check (item_type in ('consumabile','ricambio','attrezzatura','dpi','materiale')),
  add constraint inventory_items_attributes_object_check check (jsonb_typeof(attributes) = 'object'),
  add constraint inventory_items_ideal_quantity_check check (ideal_quantity >= 0),
  add constraint inventory_items_reorder_quantity_check check (reorder_quantity >= 0);

create unique index if not exists inventory_items_hotel_id_id_uidx on public.inventory_items(hotel_id, id);
alter table public.inventory_items
  drop constraint if exists inventory_items_category_hotel_fkey,
  drop constraint if exists inventory_items_parent_hotel_fkey,
  drop constraint if exists inventory_items_default_location_hotel_fkey;
alter table public.inventory_items
  add constraint inventory_items_category_hotel_fkey foreign key (hotel_id, category_id) references public.inventory_categories(hotel_id, id) on delete restrict,
  add constraint inventory_items_parent_hotel_fkey foreign key (hotel_id, parent_item_id) references public.inventory_items(hotel_id, id) on delete restrict,
  add constraint inventory_items_default_location_hotel_fkey foreign key (hotel_id, default_location_id) references public.inventory_locations(hotel_id, id) on delete restrict;

create index if not exists inventory_items_hotel_category_id_idx on public.inventory_items(hotel_id, category_id, active);
create index if not exists inventory_items_hotel_type_idx on public.inventory_items(hotel_id, item_type, active);
create index if not exists inventory_items_hotel_location_idx on public.inventory_items(hotel_id, default_location_id, active);
create index if not exists inventory_items_barcode_idx on public.inventory_items(hotel_id, barcode) where barcode is not null and barcode <> '';
create index if not exists inventory_items_tags_gin_idx on public.inventory_items using gin(tags);
create index if not exists inventory_items_synonyms_gin_idx on public.inventory_items using gin(synonyms);
create index if not exists inventory_items_attributes_gin_idx on public.inventory_items using gin(attributes);

alter table public.inventory_movements
  add column if not exists movement_type text,
  add column if not exists location_id uuid,
  add column if not exists reason_code text,
  add column if not exists reference_type text,
  add column if not exists reference_id text,
  add column if not exists correlation_id uuid not null default gen_random_uuid(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.inventory_movements
set movement_type = case when delta > 0 then 'carico' else 'scarico' end
where movement_type is null;

alter table public.inventory_movements
  alter column movement_type set not null,
  drop constraint if exists inventory_movements_type_check,
  drop constraint if exists inventory_movements_metadata_object_check,
  drop constraint if exists inventory_movements_location_hotel_fkey;
alter table public.inventory_movements
  add constraint inventory_movements_type_check check (movement_type in ('carico','scarico','consumo','trasferimento','rettifica','reso','inventario')),
  add constraint inventory_movements_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  add constraint inventory_movements_location_hotel_fkey foreign key (hotel_id, location_id) references public.inventory_locations(hotel_id, id) on delete restrict;

alter table public.inventory_movements drop constraint if exists inventory_movements_item_id_fkey;
alter table public.inventory_movements add constraint inventory_movements_item_id_fkey
  foreign key (item_id) references public.inventory_items(id) on delete restrict;

create index if not exists inventory_movements_hotel_type_created_idx on public.inventory_movements(hotel_id, movement_type, created_at desc);
create index if not exists inventory_movements_correlation_idx on public.inventory_movements(correlation_id);
create index if not exists inventory_movements_reference_idx on public.inventory_movements(hotel_id, reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

alter table public.inventory_categories enable row level security;
alter table public.inventory_locations enable row level security;

drop policy if exists inventory_categories_select on public.inventory_categories;
create policy inventory_categories_select on public.inventory_categories for select to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'view')));
drop policy if exists inventory_categories_insert on public.inventory_categories;
create policy inventory_categories_insert on public.inventory_categories for insert to authenticated
  with check ((select public.has_app_permission(hotel_id, 'inventory', 'create')));
drop policy if exists inventory_categories_update on public.inventory_categories;
create policy inventory_categories_update on public.inventory_categories for update to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'edit')))
  with check ((select public.has_app_permission(hotel_id, 'inventory', 'edit')));
drop policy if exists inventory_categories_delete on public.inventory_categories;
create policy inventory_categories_delete on public.inventory_categories for delete to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'manage')));

drop policy if exists inventory_locations_select on public.inventory_locations;
create policy inventory_locations_select on public.inventory_locations for select to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'view')));
drop policy if exists inventory_locations_insert on public.inventory_locations;
create policy inventory_locations_insert on public.inventory_locations for insert to authenticated
  with check ((select public.has_app_permission(hotel_id, 'inventory', 'create')));
drop policy if exists inventory_locations_update on public.inventory_locations;
create policy inventory_locations_update on public.inventory_locations for update to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'edit')))
  with check ((select public.has_app_permission(hotel_id, 'inventory', 'edit')));
drop policy if exists inventory_locations_delete on public.inventory_locations;
create policy inventory_locations_delete on public.inventory_locations for delete to authenticated
  using ((select public.has_app_permission(hotel_id, 'inventory', 'manage')));

-- Quantity is ledger-owned: browser users can edit metadata but cannot write the balance directly.
revoke insert, update on table public.inventory_items from authenticated;
grant insert (
  hotel_id,name,category,unit,location,sku,min_quantity,notes,active,photo_path,
  category_id,item_type,parent_item_id,variant_label,barcode,manufacturer,model,
  attributes,tags,synonyms,ideal_quantity,reorder_quantity,default_location_id
) on public.inventory_items to authenticated;
grant update (
  name,category,unit,location,sku,min_quantity,notes,active,photo_path,
  category_id,item_type,parent_item_id,variant_label,barcode,manufacturer,model,
  attributes,tags,synonyms,ideal_quantity,reorder_quantity,default_location_id
) on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_categories to authenticated;
grant select, insert, update, delete on public.inventory_locations to authenticated;
grant select on public.inventory_movements to authenticated;

create or replace function public.inventory_adjust_stock_v2(
  p_item_id uuid,
  p_delta numeric,
  p_movement_type text default null,
  p_note text default null,
  p_location_id uuid default null,
  p_reason_code text default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item public.inventory_items;
  v_before numeric(12,3);
  v_after numeric(12,3);
  v_type text;
begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'La quantità del movimento deve essere diversa da zero'; end if;

  select * into v_item from public.inventory_items where id = p_item_id and active for update;
  if not found then raise exception 'Articolo non trovato o non attivo'; end if;
  if not public.has_app_permission(v_item.hotel_id, 'inventory', 'edit') then raise exception 'Permesso magazzino non sufficiente'; end if;

  if p_location_id is not null and not exists (
    select 1 from public.inventory_locations l where l.id = p_location_id and l.hotel_id = v_item.hotel_id and l.active
  ) then raise exception 'Ubicazione non valida per questo hotel'; end if;

  v_type := coalesce(nullif(trim(p_movement_type), ''), case when p_delta > 0 then 'carico' else 'scarico' end);
  if v_type not in ('carico','scarico','consumo','trasferimento','rettifica','reso','inventario') then raise exception 'Tipo movimento non valido'; end if;
  if v_type in ('carico','reso') and p_delta < 0 then raise exception 'Il tipo movimento % richiede una quantità positiva', v_type; end if;
  if v_type in ('scarico','consumo') and p_delta > 0 then raise exception 'Il tipo movimento % richiede una quantità negativa', v_type; end if;
  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then raise exception 'metadata deve essere un oggetto JSON'; end if;

  v_before := v_item.quantity;
  v_after := v_before + p_delta;
  if v_after < 0 then raise exception 'Giacenza insufficiente'; end if;

  update public.inventory_items set quantity = v_after, updated_at = now() where id = p_item_id returning * into v_item;
  insert into public.inventory_movements(
    hotel_id,item_id,delta,quantity_before,quantity_after,movement_type,note,
    location_id,reason_code,reference_type,reference_id,metadata,created_by
  ) values (
    v_item.hotel_id,v_item.id,p_delta,v_before,v_after,v_type,nullif(trim(p_note),''),
    coalesce(p_location_id,v_item.default_location_id),nullif(trim(p_reason_code),''),
    nullif(trim(p_reference_type),''),nullif(trim(p_reference_id),''),coalesce(p_metadata,'{}'::jsonb),auth.uid()
  );
  return v_item;
end;
$$;

create or replace function public.inventory_adjust_stock(p_item_id uuid, p_delta numeric, p_note text default null)
returns public.inventory_items
language sql
security definer
set search_path = public, pg_catalog
as $$
  select public.inventory_adjust_stock_v2(
    p_item_id,p_delta,case when p_delta > 0 then 'carico' else 'scarico' end,p_note,
    null,null,null,null,'{}'::jsonb
  );
$$;

revoke all on function public.inventory_adjust_stock_v2(uuid,numeric,text,text,uuid,text,text,text,jsonb) from public;
revoke execute on function public.inventory_adjust_stock_v2(uuid,numeric,text,text,uuid,text,text,text,jsonb) from anon;
grant execute on function public.inventory_adjust_stock_v2(uuid,numeric,text,text,uuid,text,text,text,jsonb) to authenticated;
revoke all on function public.inventory_adjust_stock(uuid,numeric,text) from public;
revoke execute on function public.inventory_adjust_stock(uuid,numeric,text) from anon;
grant execute on function public.inventory_adjust_stock(uuid,numeric,text) to authenticated;

create or replace view public.inventory_reorder_status with (security_invoker = true) as
select
  i.id,i.hotel_id,i.name,i.unit,i.quantity,i.min_quantity,i.ideal_quantity,i.reorder_quantity,
  case when i.quantity <= 0 then 'esaurito'
       when i.min_quantity > 0 and i.quantity <= i.min_quantity then 'sotto_scorta'
       else 'ok' end as stock_status,
  case when i.quantity <= i.min_quantity then greatest(
    coalesce(nullif(i.reorder_quantity,0),nullif(i.ideal_quantity - i.quantity,0),i.min_quantity - i.quantity),0
  ) else 0 end as suggested_reorder
from public.inventory_items i where i.active;

create or replace view public.inventory_ledger_reconciliation with (security_invoker = true) as
select
  i.id as item_id,i.hotel_id,i.name,i.quantity as materialized_quantity,
  coalesce(sum(m.delta),0)::numeric(12,3) as ledger_quantity,
  (i.quantity - coalesce(sum(m.delta),0))::numeric(12,3) as drift
from public.inventory_items i
left join public.inventory_movements m on m.item_id = i.id
group by i.id,i.hotel_id,i.name,i.quantity;

grant select on public.inventory_reorder_status to authenticated;
grant select on public.inventory_ledger_reconciliation to authenticated;

with base(code,name,sort_order) as (
  values
    ('DA_CLASSIFICARE','Da classificare',0),('ELEC','Elettrico',10),('IDRA','Idraulica',20),
    ('HVAC','Climatizzazione / HVAC',30),('FERR','Ferramenta',40),('UTEN','Utensili',50),
    ('EDIL','Pitture e materiali edili',60),('BAGCAM','Bagni / Camere',70),('ARRED','Arredi',80),
    ('SERR','Serramenti',90),('SIC','Sicurezza',100),('PULTEC','Pulizia tecnica',110),
    ('ESTERNI','Giardino / Esterni',120),('IT','IT / Elettronica',130),('AVSALE','TV / Audio / Sale congressi',140),
    ('IMPIANTI','Ascensori / Impianti',150),('CONSUM','Consumabili generici',160)
)
insert into public.inventory_categories(hotel_id,code,name,sort_order)
select h.id,b.code,b.name,b.sort_order from public.hotels h cross join base b
on conflict (hotel_id,code) do update set name=excluded.name,sort_order=excluded.sort_order,updated_at=now();

insert into public.inventory_categories(hotel_id,parent_id,code,name,sort_order)
select h.id,p.id,'ELEC_LIGHT','Illuminazione',10
from public.hotels h join public.inventory_categories p on p.hotel_id=h.id and p.code='ELEC'
on conflict (hotel_id,code) do update set parent_id=excluded.parent_id,name=excluded.name,sort_order=excluded.sort_order,updated_at=now();

insert into public.inventory_categories(hotel_id,parent_id,code,name,sort_order,attribute_schema,synonyms,fault_terms,default_action)
select h.id,p.id,'ELEC_BULB','Lampadine',10,
  '[{"key":"attacco","label":"Attacco","type":"text","required":true},{"key":"watt","label":"Potenza","type":"number","unit":"W"},{"key":"kelvin","label":"Temperatura colore","type":"number","unit":"K"},{"key":"tensione","label":"Tensione","type":"number","unit":"V"},{"key":"dimmerabile","label":"Dimmerabile","type":"boolean"}]'::jsonb,
  array['lampadina','lampada','bulbo','luce']::text[],
  array['fulminata','bruciata','non si accende','lampeggia']::text[],
  'sostituzione'
from public.hotels h join public.inventory_categories p on p.hotel_id=h.id and p.code='ELEC_LIGHT'
on conflict (hotel_id,code) do update set
  parent_id=excluded.parent_id,name=excluded.name,attribute_schema=excluded.attribute_schema,
  synonyms=excluded.synonyms,fault_terms=excluded.fault_terms,default_action=excluded.default_action,
  sort_order=excluded.sort_order,updated_at=now();

update public.inventory_items i
set category_id = c.id
from public.inventory_categories c
where i.category_id is null and c.hotel_id = i.hotel_id
  and (lower(c.name)=lower(i.category) or (c.code='DA_CLASSIFICARE' and not exists (
    select 1 from public.inventory_categories c2 where c2.hotel_id=i.hotel_id and lower(c2.name)=lower(i.category)
  )));

do $$
begin
  if has_function_privilege('anon','public.inventory_adjust_stock_v2(uuid,numeric,text,text,uuid,text,text,text,jsonb)','EXECUTE') then
    raise exception 'inventory_adjust_stock_v2 is executable by anon';
  end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='inventory_movements' and cmd in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'inventory_movements must remain immutable to authenticated clients';
  end if;
end $$;
