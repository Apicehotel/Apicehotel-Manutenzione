begin;

-- Transitional namespace isolation for the shared Supabase project.
-- HotelGio is intentionally OUTSIDE this project and must not be touched here.
-- MultiHotel keeps ownership of public.* during the transition.
-- Eye Supremo gets a dedicated schema façade without moving production tables.

create schema if not exists eye_supremo;
comment on schema eye_supremo is
  'Eye Supremo logical space. Transitional facade over public.eye_* objects; designed for later PC/Postgres migration.';

revoke all on schema eye_supremo from public;
revoke all on schema eye_supremo from anon;
revoke all on schema eye_supremo from authenticated;
grant usage on schema eye_supremo to service_role;

do $$
declare
  object_name text;
begin
  foreach object_name in array array[
    'eye_central_invoice_blobs',
    'eye_central_invoice_rows',
    'eye_central_invoice_search',
    'eye_central_invoices',
    'eye_central_product_catalog',
    'eye_central_products',
    'eye_central_reviews',
    'eye_central_suppliers',
    'eye_central_users',
    'eye_sync_memberships',
    'eye_sync_objects'
  ]
  loop
    if to_regclass(format('public.%I', object_name)) is not null then
      execute format(
        'create or replace view eye_supremo.%I with (security_invoker=true) as select * from public.%I',
        object_name,
        object_name
      );
      execute format(
        'grant select, insert, update, delete on eye_supremo.%I to service_role',
        object_name
      );
    end if;
  end loop;
end
$$;

create table if not exists eye_supremo.space_manifest (
  id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into eye_supremo.space_manifest(id, value)
values
  ('owner', 'Eye Supremo'),
  ('mode', 'transitional_shared_supabase'),
  ('migration_target', 'pc_local_backend'),
  ('source_schema', 'public')
on conflict (id) do update
set value = excluded.value,
    updated_at = now();

revoke all on eye_supremo.space_manifest from anon, authenticated;
grant select, insert, update, delete on eye_supremo.space_manifest to service_role;

commit;
