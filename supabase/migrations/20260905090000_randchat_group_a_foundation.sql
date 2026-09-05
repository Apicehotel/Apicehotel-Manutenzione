-- RandChat Group A: per-user enablement, operational groups, cross-hotel membership,
-- realtime and 30/60 day retention. Groups are operational (not E2EE); DM E2EE is Group B.

alter table public.profiles
  add column if not exists chat_enabled boolean not null default false,
  add column if not exists chat_can_create_groups boolean not null default false;

comment on column public.profiles.chat_enabled is 'Admin-managed switch that enables RandChat for this user.';
comment on column public.profiles.chat_can_create_groups is 'Admin-managed capability to create RandChat operational groups.';

create or replace function public.protect_admin_managed_chat_profile_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if (
    new.chat_enabled is distinct from old.chat_enabled
    or new.chat_can_create_groups is distinct from old.chat_can_create_groups
  ) and current_user not in ('postgres', 'service_role', 'supabase_admin')
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'RandChat enablement is administrator-managed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_managed_chat_fields on public.profiles;
create trigger profiles_protect_admin_managed_chat_fields
before update of chat_enabled, chat_can_create_groups on public.profiles
for each row execute function public.protect_admin_managed_chat_profile_fields();

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  retention_days smallint not null default 30 check (retention_days in (30, 60)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint chat_groups_description_length check (description is null or char_length(description) <= 500)
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  active boolean not null default true,
  added_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (group_id, auth_user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pinned_at timestamptz,
  pinned_by uuid references auth.users(id) on delete set null
);

create index if not exists chat_groups_hotel_active_idx
  on public.chat_groups(hotel_id, created_at desc) where archived_at is null;
create index if not exists chat_group_members_user_active_idx
  on public.chat_group_members(auth_user_id, group_id) where active;
create index if not exists chat_group_members_group_active_idx
  on public.chat_group_members(group_id, auth_user_id) where active;
create index if not exists chat_messages_group_created_idx
  on public.chat_messages(group_id, created_at desc);
create index if not exists chat_messages_retention_idx
  on public.chat_messages(group_id, created_at) where pinned_at is null;

create or replace function public.chat_user_enabled(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = p_user and p.active = true and p.chat_enabled = true
  );
$$;

create or replace function public.chat_group_member(p_group uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.chat_user_enabled(p_user) and exists (
    select 1 from public.chat_group_members m
    join public.chat_groups g on g.id = m.group_id
    where m.group_id = p_group
      and m.auth_user_id = p_user
      and m.active = true
      and g.archived_at is null
  );
$$;

create or replace function public.chat_group_admin(p_group uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.chat_user_enabled(p_user) and exists (
    select 1 from public.chat_group_members m
    join public.chat_groups g on g.id = m.group_id
    where m.group_id = p_group
      and m.auth_user_id = p_user
      and m.active = true
      and m.role in ('owner', 'admin')
      and g.archived_at is null
  );
$$;

revoke all on function public.chat_user_enabled(uuid) from public;
revoke all on function public.chat_group_member(uuid, uuid) from public;
revoke all on function public.chat_group_admin(uuid, uuid) from public;
grant execute on function public.chat_user_enabled(uuid) to authenticated, service_role;
grant execute on function public.chat_group_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_group_admin(uuid, uuid) to authenticated, service_role;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_groups_member_select on public.chat_groups;
create policy chat_groups_member_select on public.chat_groups
for select to authenticated
using (public.chat_group_member(id, auth.uid()));

drop policy if exists chat_group_members_member_select on public.chat_group_members;
create policy chat_group_members_member_select on public.chat_group_members
for select to authenticated
using (public.chat_group_member(group_id, auth.uid()));

drop policy if exists chat_messages_member_select on public.chat_messages;
create policy chat_messages_member_select on public.chat_messages
for select to authenticated
using (public.chat_group_member(group_id, auth.uid()));

drop policy if exists chat_messages_member_insert on public.chat_messages;
create policy chat_messages_member_insert on public.chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and public.chat_group_member(group_id, auth.uid())
);

drop policy if exists chat_messages_sender_or_admin_delete on public.chat_messages;
create policy chat_messages_sender_or_admin_delete on public.chat_messages
for delete to authenticated
using (
  sender_user_id = auth.uid()
  or public.chat_group_admin(group_id, auth.uid())
);

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
  if v_user is null or not public.chat_user_enabled(v_user) then
    raise exception 'RandChat non abilitata';
  end if;
  if p_retention_days not in (30, 60) then
    raise exception 'Retention gruppo non valida';
  end if;
  if not public.is_hotel_member(p_hotel_id, v_user) then
    raise exception 'Utente non appartenente alla struttura';
  end if;

  select coalesce(p.chat_can_create_groups, false)
    into v_can_create
  from public.profiles p
  where p.auth_user_id = v_user and p.active = true;

  if not coalesce(v_can_create, false) and not public.can_admin_hotel(p_hotel_id, v_user) then
    raise exception 'Creazione gruppi non consentita';
  end if;

  insert into public.chat_groups(hotel_id, name, description, retention_days, created_by)
  values (p_hotel_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_retention_days, v_user)
  returning id into v_group;

  insert into public.chat_group_members(group_id, auth_user_id, role, active, added_by)
  values (v_group, v_user, 'owner', true, v_user);

  insert into public.operational_audit_log(hotel_id, actor_user_id, module, action, entity_type, entity_id, metadata)
  values (p_hotel_id, v_user, 'chat', 'group_created', 'chat_group', v_group::text,
    jsonb_build_object('retention_days', p_retention_days));

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
declare
  v_hotel text;
  v_user uuid := auth.uid();
begin
  if not public.chat_group_admin(p_group_id, v_user) then
    raise exception 'Amministrazione gruppo non consentita';
  end if;
  if p_retention_days is not null and p_retention_days not in (30, 60) then
    raise exception 'Retention gruppo non valida';
  end if;

  update public.chat_groups
  set name = case when p_name is null then name else btrim(p_name) end,
      description = case when p_description is null then description else nullif(btrim(p_description), '') end,
      retention_days = coalesce(p_retention_days, retention_days),
      updated_at = now()
  where id = p_group_id
  returning hotel_id into v_hotel;

  insert into public.operational_audit_log(hotel_id, actor_user_id, module, action, entity_type, entity_id, metadata)
  values (v_hotel, v_user, 'chat', 'group_updated', 'chat_group', p_group_id::text,
    jsonb_build_object('retention_days', p_retention_days));
end;
$$;

create or replace function public.chat_add_group_member(
  p_group_id uuid,
  p_auth_user_id uuid,
  p_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then
    raise exception 'Amministrazione gruppo non consentita';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Ruolo gruppo non valido';
  end if;
  if not public.chat_user_enabled(p_auth_user_id) then
    raise exception 'Utente non abilitato a RandChat';
  end if;

  select hotel_id into v_hotel from public.chat_groups where id = p_group_id;

  -- Deliberately do not touch hotel_memberships: cross-hotel access is scoped to this chat group only.
  insert into public.chat_group_members(group_id, auth_user_id, role, active, added_by, joined_at, removed_at)
  values (p_group_id, p_auth_user_id, p_role, true, v_user, now(), null)
  on conflict (group_id, auth_user_id) do update
    set role = excluded.role, active = true, added_by = excluded.added_by,
        joined_at = now(), removed_at = null;

  insert into public.operational_audit_log(hotel_id, actor_user_id, module, action, entity_type, entity_id, metadata)
  values (v_hotel, v_user, 'chat', 'member_added', 'chat_group_member', p_group_id::text,
    jsonb_build_object('member_user_id', p_auth_user_id, 'group_role', p_role));
end;
$$;

create or replace function public.chat_remove_group_member(p_group_id uuid, p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
  v_role text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then
    raise exception 'Amministrazione gruppo non consentita';
  end if;
  select role into v_role from public.chat_group_members
    where group_id = p_group_id and auth_user_id = p_auth_user_id and active;
  if v_role = 'owner' then raise exception 'Il proprietario del gruppo non può essere rimosso'; end if;

  select hotel_id into v_hotel from public.chat_groups where id = p_group_id;
  update public.chat_group_members
    set active = false, removed_at = now()
    where group_id = p_group_id and auth_user_id = p_auth_user_id and role <> 'owner';

  insert into public.operational_audit_log(hotel_id, actor_user_id, module, action, entity_type, entity_id, metadata)
  values (v_hotel, v_user, 'chat', 'member_removed', 'chat_group_member', p_group_id::text,
    jsonb_build_object('member_user_id', p_auth_user_id));
end;
$$;

create or replace function public.chat_set_group_member_role(p_group_id uuid, p_auth_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
  v_existing text;
begin
  if not public.chat_group_admin(p_group_id, v_user) then
    raise exception 'Amministrazione gruppo non consentita';
  end if;
  if p_role not in ('admin', 'member') then raise exception 'Ruolo gruppo non valido'; end if;
  select role into v_existing from public.chat_group_members
    where group_id = p_group_id and auth_user_id = p_auth_user_id and active;
  if v_existing = 'owner' then raise exception 'Il ruolo owner non può essere modificato'; end if;

  update public.chat_group_members set role = p_role
  where group_id = p_group_id and auth_user_id = p_auth_user_id and active;

  select hotel_id into v_hotel from public.chat_groups where id = p_group_id;
  insert into public.operational_audit_log(hotel_id, actor_user_id, module, action, entity_type, entity_id, metadata)
  values (v_hotel, v_user, 'chat', 'member_role_changed', 'chat_group_member', p_group_id::text,
    jsonb_build_object('member_user_id', p_auth_user_id, 'group_role', p_role));
end;
$$;

create or replace function public.chat_list_directory()
returns table(auth_user_id uuid, display_name text, hotel_ids text[])
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.auth_user_id,
         p.display_name,
         coalesce(array_agg(distinct hm.hotel_id) filter (where hm.active), '{}'::text[]) as hotel_ids
  from public.profiles p
  left join public.hotel_memberships hm on hm.auth_user_id = p.auth_user_id and hm.active
  where public.chat_user_enabled(auth.uid())
    and p.active = true
    and p.chat_enabled = true
  group by p.auth_user_id, p.display_name
  order by p.display_name;
$$;

create or replace function public.chat_list_group_members(p_group_id uuid)
returns table(auth_user_id uuid, display_name text, hotel_ids text[], group_role text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.auth_user_id,
         p.display_name,
         coalesce(array_agg(distinct hm.hotel_id) filter (where hm.active), '{}'::text[]) as hotel_ids,
         m.role as group_role
  from public.chat_group_members m
  join public.profiles p on p.auth_user_id = m.auth_user_id
  left join public.hotel_memberships hm on hm.auth_user_id = p.auth_user_id and hm.active
  where m.group_id = p_group_id
    and m.active = true
    and public.chat_group_member(p_group_id, auth.uid())
  group by p.auth_user_id, p.display_name, m.role, m.joined_at
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at, p.display_name;
$$;

create or replace function public.chat_set_message_pinned(p_message_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_group uuid;
  v_user uuid := auth.uid();
begin
  select group_id into v_group from public.chat_messages where id = p_message_id;
  if v_group is null or not public.chat_group_admin(v_group, v_user) then
    raise exception 'Amministrazione gruppo non consentita';
  end if;
  update public.chat_messages
  set pinned_at = case when p_pinned then now() else null end,
      pinned_by = case when p_pinned then v_user else null end,
      updated_at = now()
  where id = p_message_id;
end;
$$;

revoke all on function public.chat_create_group(text, text, smallint, text) from public;
revoke all on function public.chat_update_group(uuid, text, smallint, text) from public;
revoke all on function public.chat_add_group_member(uuid, uuid, text) from public;
revoke all on function public.chat_remove_group_member(uuid, uuid) from public;
revoke all on function public.chat_set_group_member_role(uuid, uuid, text) from public;
revoke all on function public.chat_list_directory() from public;
revoke all on function public.chat_list_group_members(uuid) from public;
revoke all on function public.chat_set_message_pinned(uuid, boolean) from public;
grant execute on function public.chat_create_group(text, text, smallint, text) to authenticated;
grant execute on function public.chat_update_group(uuid, text, smallint, text) to authenticated;
grant execute on function public.chat_add_group_member(uuid, uuid, text) to authenticated;
grant execute on function public.chat_remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.chat_set_group_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.chat_list_directory() to authenticated;
grant execute on function public.chat_list_group_members(uuid) to authenticated;
grant execute on function public.chat_set_message_pinned(uuid, boolean) to authenticated;

grant select on public.chat_groups, public.chat_group_members, public.chat_messages to authenticated;
grant insert, delete on public.chat_messages to authenticated;

create or replace function public.cleanup_expired_group_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_row record;
begin
  for v_row in
    with expired as (
      select m.id, m.group_id, g.hotel_id, g.retention_days
      from public.chat_messages m
      join public.chat_groups g on g.id = m.group_id
      where m.pinned_at is null
        and m.created_at < now() - make_interval(days => g.retention_days::integer)
    ), deleted as (
      delete from public.chat_messages m
      using expired e
      where m.id = e.id
      returning e.group_id, e.hotel_id, e.retention_days
    )
    select group_id, hotel_id, retention_days, count(*)::integer as deleted_count
    from deleted
    group by group_id, hotel_id, retention_days
  loop
    v_total := v_total + v_row.deleted_count;
    insert into public.operational_audit_log(hotel_id, module, action, entity_type, entity_id, metadata)
    values (
      v_row.hotel_id,
      'chat',
      'retention_cleanup',
      'chat_group',
      v_row.group_id::text,
      jsonb_build_object('deleted_count', v_row.deleted_count, 'retention_days', v_row.retention_days)
    );
  end loop;
  return v_total;
end;
$$;

revoke all on function public.cleanup_expired_group_chat_messages() from public, anon, authenticated;
grant execute on function public.cleanup_expired_group_chat_messages() to service_role;

-- The project already uses pg_cron. Run group cleanup once per night; pinned messages are excluded.
do $$ begin
  perform cron.unschedule('randchat-group-retention');
exception when others then null; end $$;
select cron.schedule(
  'randchat-group-retention',
  '17 3 * * *',
  $$select public.cleanup_expired_group_chat_messages();$$
);

-- Realtime publication, idempotent like the existing RandCore publication contract.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_groups'
  ) then alter publication supabase_realtime add table public.chat_groups; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_group_members'
  ) then alter publication supabase_realtime add table public.chat_group_members; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then alter publication supabase_realtime add table public.chat_messages; end if;
end $$;

alter table public.chat_groups replica identity full;
alter table public.chat_group_members replica identity full;
alter table public.chat_messages replica identity full;
