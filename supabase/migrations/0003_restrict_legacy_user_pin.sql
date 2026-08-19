-- Apply only after the pin-auth/user-pin/admin-users frontend flow has been verified.
-- Removes direct client access to the legacy public.utenti.pin column while
-- preserving SELECT on every other existing column.

begin;

revoke select, insert, update on table public.utenti from anon, authenticated;

-- Re-grant SELECT column-by-column, deliberately excluding the legacy PIN.
-- Dynamic discovery keeps this migration compatible with the deployed legacy
-- table even if its non-secret columns differ from older local migrations.
do $$
declare
  column_list text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into column_list
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'utenti'
     and column_name <> 'pin';

  if column_list is null then
    raise exception 'public.utenti not found or has no grantable columns';
  end if;

  execute format('grant select (%s) on table public.utenti to authenticated', column_list);
  execute format('grant select (%s) on table public.utenti to anon', column_list);
end
$$;

-- Mutations and PIN operations remain available only through server-side Edge
-- Functions using service-role credentials.

commit;
