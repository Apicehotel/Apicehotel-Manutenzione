-- Block 38 compatibility hardening.
-- Existing authorized DELETE calls become soft-delete without requiring every client path to change atomically.

create or replace function public.convert_operational_delete_to_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_operation_id text := 'RND-AUD-' || replace(gen_random_uuid()::text, '-', '');
  v_sql text;
begin
  v_sql := format(
    'update public.%I set deleted_at=coalesce(deleted_at,now()), deleted_by_user_id=coalesce(deleted_by_user_id,$1), delete_operation_id=coalesce(delete_operation_id,$2)',
    tg_table_name
  );
  if to_jsonb(old) ? 'updated_at' then
    v_sql := v_sql || ', updated_at=now()';
  end if;
  v_sql := v_sql || ' where id=$3 and hotel_id=$4';
  execute v_sql using auth.uid(), v_operation_id, old.id, old.hotel_id;
  return null;
end;
$$;

revoke all on function public.convert_operational_delete_to_soft_delete() from public, anon, authenticated;

DO $$
declare t text;
begin
  foreach t in array array['segnalazioni','interventi','planning_lavori','planning_lavori_giorni']
  loop
    execute format('drop trigger if exists %I on public.%I', 'reversible_delete_' || t, t);
    execute format(
      'create trigger %I before delete on public.%I for each row when (old.deleted_at is null) execute function public.convert_operational_delete_to_soft_delete()',
      'reversible_delete_' || t, t
    );
  end loop;
end $$;

-- Deleted rows are hidden from ordinary application SELECTs.
-- Restore remains available only through the scoped SECURITY DEFINER RPCs from the main Block 38 migration.
alter policy segnalazioni_permission_select on public.segnalazioni
  using (public.has_app_permission(hotel_id,'issues','view') and deleted_at is null);

alter policy interventi_permission_select on public.interventi
  using (public.has_app_permission(hotel_id,'interventions','view') and deleted_at is null);

alter policy planning_lavori_permission_select on public.planning_lavori
  using (public.has_app_permission(hotel_id,'planning_work','view') and deleted_at is null);

alter policy planning_lavori_giorni_permission_select on public.planning_lavori_giorni
  using (public.has_app_permission(hotel_id,'planning_work','view') and deleted_at is null);

-- Direct UPDATEs cannot modify already-deleted rows through ordinary client paths.
alter policy segnalazioni_permission_update on public.segnalazioni
  using (
    deleted_at is null and (
      public.has_app_permission(hotel_id,'issues','edit')
      or public.has_app_permission(hotel_id,'issues','take_charge')
      or public.has_app_permission(hotel_id,'issues','complete')
      or public.has_app_permission(hotel_id,'issues','assign')
      or (created_by_user_id = auth.uid() and public.has_hotel_role(hotel_id,array['Supremo']))
    )
  )
  with check (
    deleted_at is null and (
      public.has_app_permission(hotel_id,'issues','edit')
      or public.has_app_permission(hotel_id,'issues','take_charge')
      or public.has_app_permission(hotel_id,'issues','complete')
      or public.has_app_permission(hotel_id,'issues','assign')
      or (created_by_user_id = auth.uid() and public.has_hotel_role(hotel_id,array['Supremo']))
    )
  );

alter policy interventi_permission_update on public.interventi
  using (deleted_at is null and (
    public.has_app_permission(hotel_id,'interventions','edit')
    or public.has_app_permission(hotel_id,'interventions','take_charge')
    or public.has_app_permission(hotel_id,'interventions','complete')
    or public.has_app_permission(hotel_id,'interventions','assign')
  ))
  with check (deleted_at is null and (
    public.has_app_permission(hotel_id,'interventions','edit')
    or public.has_app_permission(hotel_id,'interventions','take_charge')
    or public.has_app_permission(hotel_id,'interventions','complete')
    or public.has_app_permission(hotel_id,'interventions','assign')
  ));

alter policy planning_lavori_permission_update on public.planning_lavori
  using (deleted_at is null and (
    public.has_app_permission(hotel_id,'planning_work','edit')
    or public.has_app_permission(hotel_id,'planning_work','take_charge')
    or public.has_app_permission(hotel_id,'planning_work','complete')
    or public.has_app_permission(hotel_id,'planning_work','assign')
  ))
  with check (deleted_at is null and (
    public.has_app_permission(hotel_id,'planning_work','edit')
    or public.has_app_permission(hotel_id,'planning_work','take_charge')
    or public.has_app_permission(hotel_id,'planning_work','complete')
    or public.has_app_permission(hotel_id,'planning_work','assign')
  ));

alter policy planning_lavori_giorni_permission_update on public.planning_lavori_giorni
  using (deleted_at is null and (
    public.has_app_permission(hotel_id,'planning_work','edit')
    or public.has_app_permission(hotel_id,'planning_work','complete')
  ))
  with check (deleted_at is null and (
    public.has_app_permission(hotel_id,'planning_work','edit')
    or public.has_app_permission(hotel_id,'planning_work','complete')
  ));
