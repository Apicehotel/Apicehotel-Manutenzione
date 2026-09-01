-- Reliability Block 39 — atomic compare-and-swap delete for Segnalazioni.
-- The client supplies the exact PostgreSQL updated_at token captured with the cached row.

create or replace function public.soft_delete_issue_cas(
  p_id uuid,
  p_hotel_id text,
  p_operation_id text,
  p_reason text default null,
  p_expected_updated_at timestamptz default null
) returns public.segnalazioni
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.segnalazioni;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if p_hotel_id is null or btrim(p_hotel_id) = '' then
    raise exception 'hotel_id mancante' using errcode = '22023';
  end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then
    raise exception 'operation_id non valido' using errcode = '22023';
  end if;

  select * into v_row
  from public.segnalazioni
  where id = p_id and hotel_id = p_hotel_id
  for update;

  if not found then
    raise exception 'Segnalazione non trovata' using errcode = 'P0002';
  end if;

  if v_row.deleted_at is not null then
    return v_row;
  end if;

  if not (
    public.has_app_permission(p_hotel_id, 'issues', 'delete')
    or (v_row.created_by_user_id = v_uid and public.is_hotel_member(p_hotel_id))
  ) then
    raise exception 'Non autorizzato a eliminare la segnalazione' using errcode = '42501';
  end if;

  if p_expected_updated_at is not null and v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Conflitto: segnalazione modificata dopo il caricamento' using errcode = '40001';
  end if;

  update public.segnalazioni
  set deleted_at = now(),
      deleted_by_user_id = v_uid,
      deleted_reason = nullif(btrim(p_reason), ''),
      delete_operation_id = p_operation_id,
      restored_at = null,
      restored_by_user_id = null,
      restore_operation_id = null
  where id = p_id and hotel_id = p_hotel_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.soft_delete_issue_cas(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.soft_delete_issue_cas(uuid,text,text,text,timestamptz) to authenticated;
