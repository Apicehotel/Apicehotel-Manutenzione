create table if not exists public.sale_layout_snapshots (
  booking_id uuid primary key references public.prenotazioni_sale(id) on delete cascade,
  hotel_id text not null references public.hotels(id),
  version integer not null default 1 check (version > 0),
  document jsonb not null,
  updated_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_layout_snapshot_document_object check (jsonb_typeof(document) = 'object'),
  unique (booking_id, hotel_id)
);

create index if not exists sale_layout_snapshots_hotel_updated_idx on public.sale_layout_snapshots(hotel_id, updated_at desc);
alter table public.sale_layout_snapshots enable row level security;
revoke all on table public.sale_layout_snapshots from anon;
grant select on table public.sale_layout_snapshots to authenticated;

drop policy if exists sale_layout_snapshots_ops_select on public.sale_layout_snapshots;
create policy sale_layout_snapshots_ops_select on public.sale_layout_snapshots for select to authenticated
using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi','manutentore']));

create or replace function public.save_sale_layout_snapshot(p_booking_id uuid, p_hotel_id text, p_document jsonb, p_expected_version integer default 0)
returns public.sale_layout_snapshots
language plpgsql security definer set search_path=public
as $$
declare v_row public.sale_layout_snapshots;
begin
  if (select auth.uid()) is null or not public.has_hotel_role(p_hotel_id, array['Direttore Centro Congressi']) then raise exception 'sale_layout_permission_denied'; end if;
  if pg_column_size(p_document) > 262144 or jsonb_typeof(p_document) <> 'object' or coalesce((p_document->>'schemaVersion')::integer,0) <> 1 or p_document->>'unit' <> 'cm' or jsonb_typeof(p_document->'items') <> 'array' or jsonb_array_length(p_document->'items') > 250 then raise exception 'sale_layout_invalid_document'; end if;
  if not exists(select 1 from public.prenotazioni_sale where id=p_booking_id and hotel_id=p_hotel_id) then raise exception 'sale_layout_booking_scope_denied'; end if;
  insert into public.sale_layout_snapshots(booking_id,hotel_id,version,document,updated_by)
  select p_booking_id,p_hotel_id,1,p_document,(select auth.uid())
  where p_expected_version=0 or exists(select 1 from public.sale_layout_snapshots where booking_id=p_booking_id and hotel_id=p_hotel_id and version=p_expected_version)
  on conflict(booking_id) do update set document=excluded.document,version=public.sale_layout_snapshots.version+1,updated_by=(select auth.uid()),updated_at=now()
  where public.sale_layout_snapshots.version=p_expected_version and public.sale_layout_snapshots.hotel_id=p_hotel_id
  returning * into v_row;
  if v_row.booking_id is null or (p_expected_version=0 and v_row.version<>1) then raise exception 'sale_layout_version_conflict'; end if;
  return v_row;
end $$;

revoke all on function public.save_sale_layout_snapshot(uuid,text,jsonb,integer) from public,anon;
grant execute on function public.save_sale_layout_snapshot(uuid,text,jsonb,integer) to authenticated;
comment on table public.sale_layout_snapshots is 'Versioned renderer-independent RandSale 2D snapshot for the canonical Planning Sale booking.';
