-- RandSale 2D remains a child of the canonical Planning Sale booking.
-- Permissions follow the configurable planning_sale matrix rather than role names.
drop policy if exists sale_layout_snapshots_ops_select on public.sale_layout_snapshots;
create policy sale_layout_snapshots_permission_select
on public.sale_layout_snapshots for select to authenticated
using (public.has_app_permission(hotel_id, 'planning_sale', 'view'));

create or replace function public.save_sale_layout_snapshot(
  p_booking_id uuid,
  p_hotel_id text,
  p_document jsonb,
  p_expected_version integer default 0
)
returns public.sale_layout_snapshots
language plpgsql
security definer
set search_path=public
as $$
declare
  v_booking public.prenotazioni_sale;
  v_document jsonb;
  v_row public.sale_layout_snapshots;
begin
  if (select auth.uid()) is null or not (
    public.has_app_permission(p_hotel_id, 'planning_sale', 'manage')
    or public.has_app_permission(p_hotel_id, 'planning_sale', 'edit')
  ) then
    raise exception 'sale_layout_permission_denied';
  end if;

  select * into v_booking
  from public.prenotazioni_sale
  where id = p_booking_id and hotel_id = p_hotel_id;
  if v_booking.id is null then raise exception 'sale_layout_booking_scope_denied'; end if;

  if pg_column_size(p_document) > 262144
    or jsonb_typeof(p_document) <> 'object'
    or coalesce((p_document->>'schemaVersion')::integer, 0) <> 1
    or p_document->>'unit' <> 'cm'
    or jsonb_typeof(p_document->'items') <> 'array'
    or jsonb_array_length(p_document->'items') > 250
  then raise exception 'sale_layout_invalid_document'; end if;

  -- Booking identity is authoritative: clients cannot detach a drawing from its
  -- hotel, room, configured layout or PAX while saving arbitrary JSON.
  v_document := p_document || jsonb_build_object(
    'roomKey', v_booking.sala_key,
    'roomName', v_booking.sala,
    'layoutKey', v_booking.allestimento_key,
    'layoutName', v_booking.allestimento,
    'pax', v_booking.pax
  );

  insert into public.sale_layout_snapshots(booking_id, hotel_id, version, document, updated_by)
  select p_booking_id, p_hotel_id, 1, v_document, (select auth.uid())
  where p_expected_version = 0
     or exists (
       select 1 from public.sale_layout_snapshots
       where booking_id = p_booking_id and hotel_id = p_hotel_id and version = p_expected_version
     )
  on conflict (booking_id) do update
    set document = excluded.document,
        version = public.sale_layout_snapshots.version + 1,
        updated_by = (select auth.uid()),
        updated_at = now()
  where public.sale_layout_snapshots.version = p_expected_version
    and public.sale_layout_snapshots.hotel_id = p_hotel_id
  returning * into v_row;

  if v_row.booking_id is null or (p_expected_version = 0 and v_row.version <> 1) then
    raise exception 'sale_layout_version_conflict';
  end if;
  return v_row;
end $$;

revoke all on function public.save_sale_layout_snapshot(uuid,text,jsonb,integer) from public, anon;
grant execute on function public.save_sale_layout_snapshot(uuid,text,jsonb,integer) to authenticated;

comment on function public.save_sale_layout_snapshot(uuid,text,jsonb,integer)
is 'CAS save for the renderer-independent layout attached to one canonical Planning Sale booking.';
