-- Keep cleanup simple and deterministic: delete per group, capture ROW_COUNT, audit only counts.
create or replace function public.cleanup_expired_group_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_deleted integer;
  v_total integer := 0;
begin
  for v_group in
    select id, hotel_id, retention_days
    from public.chat_groups
  loop
    delete from public.chat_messages
    where group_id = v_group.id
      and pinned_at is null
      and created_at < now() - make_interval(days => v_group.retention_days::integer);
    get diagnostics v_deleted = row_count;
    if v_deleted > 0 then
      v_total := v_total + v_deleted;
      perform public.chat_write_audit(
        v_group.hotel_id,
        'retention_cleanup',
        'chat_group',
        v_group.id::text,
        jsonb_build_object('deleted_count', v_deleted, 'retention_days', v_group.retention_days),
        null
      );
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.cleanup_expired_group_chat_messages() from public, anon, authenticated;
grant execute on function public.cleanup_expired_group_chat_messages() to service_role;
