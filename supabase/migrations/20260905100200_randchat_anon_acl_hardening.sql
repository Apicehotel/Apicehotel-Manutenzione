-- RandChat ACL hardening.
-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Revoke PUBLIC/anon from every RandChat function, then re-grant only the
-- authenticated/service roles intentionally used by the app and workers.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'chat_%'
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
  end loop;
end $$;

-- Group A authenticated surface and policy helpers.
grant execute on function public.chat_user_enabled(uuid) to authenticated, service_role;
grant execute on function public.chat_group_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_group_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_create_group(text, text, smallint, text) to authenticated;
grant execute on function public.chat_update_group(uuid, text, smallint, text) to authenticated;
grant execute on function public.chat_add_group_member(uuid, uuid, text) to authenticated;
grant execute on function public.chat_remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.chat_set_group_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.chat_list_directory() to authenticated;
grant execute on function public.chat_list_group_members(uuid) to authenticated;
grant execute on function public.chat_set_message_pinned(uuid, boolean) to authenticated;

-- Group B authenticated surface and policy helper.
grant execute on function public.chat_dm_participant(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_dm_register_device(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.chat_dm_revoke_device(uuid) to authenticated;
grant execute on function public.chat_dm_open_thread(uuid) to authenticated;
grant execute on function public.chat_dm_list_threads() to authenticated;
grant execute on function public.chat_dm_list_devices(uuid) to authenticated;
grant execute on function public.chat_dm_send_message(uuid, uuid, uuid, text, text, jsonb, text, jsonb) to authenticated;
grant execute on function public.chat_dm_list_messages(uuid, uuid, integer) to authenticated;
grant execute on function public.chat_dm_set_retention(uuid, smallint) to authenticated;
grant execute on function public.chat_link_issue(text, uuid, uuid, uuid, text) to authenticated;

-- Server-only functions remain server-only.
grant execute on function public.chat_write_audit(text, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.cleanup_expired_group_chat_messages() to service_role;
grant execute on function public.cleanup_expired_dm_messages() to service_role;
