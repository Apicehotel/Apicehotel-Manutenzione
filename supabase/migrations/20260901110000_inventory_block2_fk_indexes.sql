create index if not exists inventory_stocktake_lines_hotel_item_idx on public.inventory_stocktake_lines(hotel_id,item_id);
create index if not exists inventory_stocktakes_hotel_location_idx on public.inventory_stocktakes(hotel_id,location_id);
create index if not exists inventory_transfers_source_item_idx on public.inventory_transfers(source_hotel_id,source_item_id);
create index if not exists inventory_transfers_destination_item_idx on public.inventory_transfers(destination_hotel_id,destination_item_id);
