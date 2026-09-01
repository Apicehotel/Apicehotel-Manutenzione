alter table public.inventory_transfers add column if not exists item_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.inventory_start_transfer(p_source_item_id uuid,p_destination_hotel_id text,p_quantity numeric,p_note text default null) returns public.inventory_transfers language plpgsql security definer set search_path='public','pg_catalog' as $$ declare v_item public.inventory_items; v_transfer public.inventory_transfers; v_before numeric(12,3); v_after numeric(12,3); begin
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantità non valida'; end if;
 select * into v_item from public.inventory_items where id=p_source_item_id and active for update; if not found then raise exception 'Articolo non trovato'; end if;
 if v_item.hotel_id=p_destination_hotel_id then raise exception 'La destinazione deve essere un altro hotel'; end if;
 if auth.uid() is null or not public.has_app_permission(v_item.hotel_id,'inventory','edit') then raise exception 'Permesso magazzino sorgente non sufficiente'; end if;
 if not exists(select 1 from public.hotels where id=p_destination_hotel_id and active) then raise exception 'Hotel destinazione non valido'; end if;
 v_before:=v_item.quantity; v_after:=v_before-p_quantity; if v_after<0 then raise exception 'Giacenza insufficiente'; end if;
 insert into public.inventory_transfers(source_hotel_id,destination_hotel_id,source_item_id,quantity,note,item_snapshot) values(v_item.hotel_id,p_destination_hotel_id,v_item.id,p_quantity,nullif(trim(p_note),''),jsonb_build_object('name',v_item.name,'unit',v_item.unit,'sku',v_item.sku,'barcode',v_item.barcode,'variantLabel',v_item.variant_label)) returning * into v_transfer;
 update public.inventory_items set quantity=v_after,updated_at=now() where id=v_item.id;
 insert into public.inventory_movements(hotel_id,item_id,delta,quantity_before,quantity_after,movement_type,note,location_id,reason_code,reference_type,reference_id,metadata,created_by) values(v_item.hotel_id,v_item.id,-p_quantity,v_before,v_after,'trasferimento',coalesce(nullif(trim(p_note),''),'Spedito a '||p_destination_hotel_id),v_item.default_location_id,'transfer_out','transfer',v_transfer.id::text,jsonb_build_object('destinationHotelId',p_destination_hotel_id),auth.uid()); return v_transfer; end $$;

create or replace function public.inventory_cancel_transfer(p_transfer_id uuid) returns public.inventory_transfers language plpgsql security definer set search_path='public','pg_catalog' as $$ declare v_t public.inventory_transfers; v_item public.inventory_items; v_before numeric(12,3); begin
 select * into v_t from public.inventory_transfers where id=p_transfer_id for update; if not found or v_t.status<>'in_transit' then raise exception 'Trasferimento non annullabile'; end if;
 if auth.uid() is null or not public.has_app_permission(v_t.source_hotel_id,'inventory','edit') then raise exception 'Permesso magazzino sorgente non sufficiente'; end if;
 select * into v_item from public.inventory_items where id=v_t.source_item_id for update; if not found then raise exception 'Articolo sorgente non trovato'; end if;
 v_before:=v_item.quantity; update public.inventory_items set quantity=quantity+v_t.quantity,updated_at=now() where id=v_item.id returning * into v_item;
 insert into public.inventory_movements(hotel_id,item_id,delta,quantity_before,quantity_after,movement_type,note,location_id,reason_code,reference_type,reference_id,metadata,created_by) values(v_t.source_hotel_id,v_item.id,v_t.quantity,v_before,v_item.quantity,'trasferimento','Annullamento trasferimento',v_item.default_location_id,'transfer_cancel','transfer',v_t.id::text,jsonb_build_object('destinationHotelId',v_t.destination_hotel_id),auth.uid());
 update public.inventory_transfers set status='cancelled' where id=v_t.id returning * into v_t; return v_t; end $$;

create or replace function public.inventory_cancel_stocktake(p_stocktake_id uuid) returns public.inventory_stocktakes language plpgsql security definer set search_path='public','pg_catalog' as $$ declare v_take public.inventory_stocktakes; begin
 select * into v_take from public.inventory_stocktakes where id=p_stocktake_id for update; if not found or v_take.status<>'open' then raise exception 'Inventario non annullabile'; end if;
 if auth.uid() is null or not public.has_app_permission(v_take.hotel_id,'inventory','edit') then raise exception 'Permesso magazzino non sufficiente'; end if;
 update public.inventory_stocktakes set status='cancelled',finalized_by=auth.uid(),finalized_at=now() where id=p_stocktake_id returning * into v_take; return v_take; end $$;

revoke all on function public.inventory_cancel_transfer(uuid),public.inventory_cancel_stocktake(uuid) from public,anon;
grant execute on function public.inventory_cancel_transfer(uuid),public.inventory_cancel_stocktake(uuid) to authenticated;
