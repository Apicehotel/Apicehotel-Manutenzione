create table if not exists public.sale_layout_snapshot_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.prenotazioni_sale(id) on delete cascade,
  hotel_id text not null references public.hotels(id),
  version integer not null check (version > 0),
  document jsonb not null,
  change_reason text not null default 'Modifica layout',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint sale_layout_history_document_object check (jsonb_typeof(document) = 'object'),
  unique (booking_id, version)
);

create index if not exists sale_layout_history_booking_idx
  on public.sale_layout_snapshot_history(booking_id, version desc);
create index if not exists sale_layout_history_hotel_idx
  on public.sale_layout_snapshot_history(hotel_id, created_at desc);

alter table public.sale_layout_snapshot_history enable row level security;
revoke all on table public.sale_layout_snapshot_history from anon;
grant select on table public.sale_layout_snapshot_history to authenticated;

drop policy if exists sale_layout_history_ops_select on public.sale_layout_snapshot_history;
create policy sale_layout_history_ops_select on public.sale_layout_snapshot_history
for select to authenticated
using (
  public.has_app_permission(hotel_id, 'planning_sale', 'manage')
  or public.has_app_permission(hotel_id, 'planning_sale', 'edit')
);

create or replace function public.capture_sale_layout_history()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_reason text;
begin
  v_reason := nullif(current_setting('app.sale_layout_reason', true), '');
  insert into public.sale_layout_snapshot_history(
    booking_id, hotel_id, version, document, change_reason, created_by, created_at
  ) values (
    new.booking_id,
    new.hotel_id,
    new.version,
    new.document,
    coalesce(v_reason, case when tg_op='INSERT' then 'Creazione layout' else 'Modifica layout' end),
    new.updated_by,
    new.updated_at
  ) on conflict (booking_id, version) do nothing;
  return new;
end $$;

drop trigger if exists sale_layout_snapshot_history_trigger on public.sale_layout_snapshots;
create trigger sale_layout_snapshot_history_trigger
after insert or update of document, version on public.sale_layout_snapshots
for each row execute function public.capture_sale_layout_history();

insert into public.sale_layout_snapshot_history(
  booking_id, hotel_id, version, document, change_reason, created_by, created_at
)
select booking_id, hotel_id, version, document, 'Versione iniziale importata', updated_by, updated_at
from public.sale_layout_snapshots
on conflict (booking_id, version) do nothing;

create or replace function public.save_sale_layout_snapshot_v2(
  p_booking_id uuid,
  p_hotel_id text,
  p_document jsonb,
  p_expected_version integer default 0,
  p_reason text default 'Modifica layout'
)
returns public.sale_layout_snapshots
language plpgsql security definer set search_path=public
as $$
declare
  v_booking public.prenotazioni_sale;
  v_document jsonb;
  v_row public.sale_layout_snapshots;
begin
  if (select auth.uid()) is null or not (
    public.has_app_permission(p_hotel_id, 'planning_sale', 'manage')
    or public.has_app_permission(p_hotel_id, 'planning_sale', 'edit')
  ) then raise exception 'sale_layout_permission_denied'; end if;

  select * into v_booking
  from public.prenotazioni_sale
  where id=p_booking_id and hotel_id=p_hotel_id;
  if v_booking.id is null then raise exception 'sale_layout_booking_scope_denied'; end if;

  if pg_column_size(p_document) > 262144
    or jsonb_typeof(p_document) <> 'object'
    or coalesce((p_document->>'schemaVersion')::integer,0) <> 1
    or p_document->>'unit' <> 'cm'
    or jsonb_typeof(p_document->'items') <> 'array'
    or jsonb_array_length(p_document->'items') > 250 then
    raise exception 'sale_layout_invalid_document';
  end if;

  v_document := p_document || jsonb_build_object(
    'roomKey', v_booking.sala_key,
    'roomName', v_booking.sala,
    'layoutKey', v_booking.allestimento_key,
    'layoutName', v_booking.allestimento,
    'pax', v_booking.pax
  );

  perform set_config('app.sale_layout_reason', left(coalesce(nullif(trim(p_reason),''),'Modifica layout'),120), true);

  insert into public.sale_layout_snapshots(booking_id,hotel_id,version,document,updated_by)
  select p_booking_id,p_hotel_id,1,v_document,(select auth.uid())
  where p_expected_version=0
    or exists(select 1 from public.sale_layout_snapshots where booking_id=p_booking_id and hotel_id=p_hotel_id and version=p_expected_version)
  on conflict(booking_id) do update
    set document=excluded.document,
        version=public.sale_layout_snapshots.version+1,
        updated_by=(select auth.uid()),
        updated_at=now()
  where public.sale_layout_snapshots.version=p_expected_version
    and public.sale_layout_snapshots.hotel_id=p_hotel_id
  returning * into v_row;

  if v_row.booking_id is null or (p_expected_version=0 and v_row.version<>1) then
    raise exception 'sale_layout_version_conflict';
  end if;
  return v_row;
end $$;

revoke all on function public.save_sale_layout_snapshot_v2(uuid,text,jsonb,integer,text) from public,anon;
grant execute on function public.save_sale_layout_snapshot_v2(uuid,text,jsonb,integer,text) to authenticated;

create or replace function public.restore_sale_layout_snapshot(
  p_booking_id uuid,
  p_hotel_id text,
  p_source_version integer,
  p_expected_version integer
)
returns public.sale_layout_snapshots
language plpgsql security definer set search_path=public
as $$
declare v_document jsonb;
begin
  if (select auth.uid()) is null or not (
    public.has_app_permission(p_hotel_id, 'planning_sale', 'manage')
    or public.has_app_permission(p_hotel_id, 'planning_sale', 'edit')
  ) then raise exception 'sale_layout_permission_denied'; end if;

  select document into v_document
  from public.sale_layout_snapshot_history
  where booking_id=p_booking_id and hotel_id=p_hotel_id and version=p_source_version;
  if v_document is null then raise exception 'sale_layout_history_not_found'; end if;

  return public.save_sale_layout_snapshot_v2(
    p_booking_id,
    p_hotel_id,
    v_document,
    p_expected_version,
    format('Ripristino dalla versione %s', p_source_version)
  );
end $$;

revoke all on function public.restore_sale_layout_snapshot(uuid,text,integer,integer) from public,anon;
grant execute on function public.restore_sale_layout_snapshot(uuid,text,integer,integer) to authenticated;

comment on table public.sale_layout_snapshot_history is 'Append-only history of RandSale 2D booking layouts. Restores create a new version and never rewrite history.';
