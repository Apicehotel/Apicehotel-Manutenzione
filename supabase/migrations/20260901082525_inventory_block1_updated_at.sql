-- RandApp Magazzino — Blocco 1 follow-up
-- Mantiene updated_at server-side sulle entità modificabili del Magazzino.

create or replace function public.inventory_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.inventory_set_updated_at();

drop trigger if exists inventory_categories_set_updated_at on public.inventory_categories;
create trigger inventory_categories_set_updated_at
before update on public.inventory_categories
for each row execute function public.inventory_set_updated_at();

drop trigger if exists inventory_locations_set_updated_at on public.inventory_locations;
create trigger inventory_locations_set_updated_at
before update on public.inventory_locations
for each row execute function public.inventory_set_updated_at();
