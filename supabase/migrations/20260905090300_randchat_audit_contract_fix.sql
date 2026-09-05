-- RandChat initially targeted the newer audit naming used by design notes.
-- The live repository contract is operation_id/record_type/record_id. Replace the RPCs
-- before first use so no message body is ever written into audit.

create or replace function public.chat_write_audit(
  p_hotel_id text,
  p_action text,
  p_record_type text,
  p_record_id text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role text;
begin
  if p_actor_user_id is not null then
    select hm.role into v_role
    from public.hotel_memberships hm
    where hm.auth_user_id = p_actor_user_id and hm.hotel_id = p_hotel_id and hm.active
    limit 1;
  end if;

  insert into public.operational_audit_log(
    operation_id, hotel_id, actor_user_id, actor_role, module, action,
    record_type, record_id, source, outcome, metadata
  ) values (
    'RND-AUD-' || replace(gen_random_uuid()::text, '-', ''),
    p_hotel_id, p_actor_user_id, v_role, 'chat', p_action,
    p_record_type, p_record_id, 'database', 'succeeded', coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.chat_write_audit(text,text,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.chat_write_audit(text,text,text,text,jsonb,uuid) to service_role;

create or replace function public.chat_create_group(
  p_hotel_id text,
  p_name text,
  p_retention_days smallint default 30,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_group uuid;
  v_can_create boolean;
begin
  if v_user is null or not public.chat_user_enabled(v_user) then raise exception 'RandChat non abilitata'; end if;
  if p_retention_days not in (30, 60) then raise exception 'Retention gruppo non valida'; end if;
  if not public.is_hotel_member(p_hotel_id, v_user) then raise exception 'Utente non appartenente alla struttura'; end if;
  select coalesce(p.chat_can_create_groups, false) into v_can_create from public.profiles p where p.auth_user_id = v_user and p.active;
  if not coalesce(v_can_create, false) and not public.can_admin_hotel(p_hotel_id, v_user) then raise exception 'Creazione gruppi non consentita'; end if;

  insert into public.chat_groups(hotel_id, name, description, retention_days, created_by)
  values (p_hotel_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_retention_days, v_user)
  returning id into v_group;
  insert into public.chat_group_members(group_id, auth_user_id, role, active, added_by)
  values (v_group, v_user, 'owner', true, v_user);
  perform public.chat_write_audit(p_hotel_id, 'group_created', 'chat_group', v_group::text, jsonb_build_object('retention_days', p_retention_days), v_user);
  return v_group;
end;
$$;

create or replace function public.chat_update_group(
  p_group_id uuid,
  p_name text default null,
  p_retention_days smallint default null,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_hotel text; v_user uuid := auth.uid();
begin
  if not public.chat_group_admin(p_group_id, v_user) then raise exception 'Amministrazione gruppo non consentita'; end if;
  if p_retention_days is not null and p_retention_days not in (30, 60) then raise exception 'Retention gruppo non valida'; end if;
  update public.chat_groups set
    name = case when p_name is null then name else btrim(p_name) end,
    description = case when p_description is null then description else nullif(btrim(p_description), '') end,
    retention_days = coalesce(p_retention_days, retention_days), updated_at = now()
  where id = p_group_id returning hotel_id into v_hotel;
  perform public.chat_write_audit(v_hotel, 'group_updated', 'chat_group', p_group_id::text, jsonb_build_object('retention_days', p_retention_days), v_user);
end;
$$;

create or replace function public.chat_add_group_member(p_group_id uuid, p_auth_user_id uuid, p_role text default 'member')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid(); v_hotel text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then raise exception 'Amministrazione gruppo non consentita'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Ruolo gruppo non valido'; end if;
  if not public.chat_user_enabled(p_auth_user_id) then raise exception 'Utente non abilitato a RandChat'; end if;
  select hotel_id into v_hotel from public.chat_groups where id = p_group_id;
  -- Cross-hotel membership is deliberately scoped to chat_group_members only.
  insert into public.chat_group_members(group_id, auth_user_id, role, active, added_by, joined_at, removed_at)
  values (p_group_id, p_auth_user_id, p_role, true, v_user, now(), null)
  on conflict (group_id, auth_user_id) do update set role=excluded.role,active=true,added_by=excluded.added_by,joined_at=now(),removed_at=null;
  perform public.chat_write_audit(v_hotel, 'member_added', 'chat_group_member', p_group_id::text, jsonb_build_object('member_user_id',p_auth_user_id,'group_role',p_role), v_user);
end;
$$;

create or replace function public.chat_remove_group_member(p_group_id uuid, p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid(); v_hotel text; v_role text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then raise exception 'Amministrazione gruppo non consentita'; end if;
  select role into v_role from public.chat_group_members where group_id=p_group_id and auth_user_id=p_auth_user_id and active;
  if v_role='owner' then raise exception 'Il proprietario del gruppo non può essere rimosso'; end if;
  select hotel_id into v_hotel from public.chat_groups where id=p_group_id;
  update public.chat_group_members set active=false,removed_at=now() where group_id=p_group_id and auth_user_id=p_auth_user_id and role<>'owner';
  perform public.chat_write_audit(v_hotel, 'member_removed', 'chat_group_member', p_group_id::text, jsonb_build_object('member_user_id',p_auth_user_id), v_user);
end;
$$;

create or replace function public.chat_set_group_member_role(p_group_id uuid, p_auth_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid(); v_hotel text; v_existing text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then raise exception 'Amministrazione gruppo non consentita'; end if;
  if p_role not in ('admin','member') then raise exception 'Ruolo gruppo non valido'; end if;
  select role into v_existing from public.chat_group_members where group_id=p_group_id and auth_user_id=p_auth_user_id and active;
  if v_existing='owner' then raise exception 'Il ruolo owner non può essere modificato'; end if;
  update public.chat_group_members set role=p_role where group_id=p_group_id and auth_user_id=p_auth_user_id and active;
  select hotel_id into v_hotel from public.chat_groups where id=p_group_id;
  perform public.chat_write_audit(v_hotel, 'member_role_changed', 'chat_group_member', p_group_id::text, jsonb_build_object('member_user_id',p_auth_user_id,'group_role',p_role), v_user);
end;
$$;

create or replace function public.cleanup_expired_group_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer := 0; v_row record;
begin
  for v_row in
    with expired as (
      select m.id,m.group_id,g.hotel_id,g.retention_days
      from public.chat_messages m join public.chat_groups g on g.id=m.group_id
      where m.pinned_at is null and m.created_at < now()-make_interval(days=>g.retention_days::integer)
    ), deleted as (
      delete from public.chat_messages m using expired e where m.id=e.id
      returning e.group_id,e.hotel_id,e.retention_days
    )
    select group_id,hotel_id,retention_days,count(*)::integer deleted_count from deleted group by group_id,hotel_id,retention_days
  loop
    v_total:=v_total+v_row.deleted_count;
    perform public.chat_write_audit(v_row.hotel_id,'retention_cleanup','chat_group',v_row.group_id::text,jsonb_build_object('deleted_count',v_row.deleted_count,'retention_days',v_row.retention_days),null);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.cleanup_expired_group_chat_messages() from public, anon, authenticated;
grant execute on function public.cleanup_expired_group_chat_messages() to service_role;
