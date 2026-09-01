-- RandApp Magazzino — Blocco 1 performance follow-up
-- Copre le FK composite segnalate dal database advisor.

create index if not exists inventory_items_hotel_parent_item_idx
  on public.inventory_items(hotel_id, parent_item_id)
  where parent_item_id is not null;

create index if not exists inventory_movements_hotel_location_idx
  on public.inventory_movements(hotel_id, location_id)
  where location_id is not null;
