-- RandChat Group C: approved procedures, authorized RandAI context and RandMedia.
-- Groups are operational plaintext; DM media remains E2EE because files are encrypted client-side.

-- ---------------------------------------------------------------------------
-- Procedures shared into operational groups.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_procedure_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  group_message_id uuid not null references public.chat_messages(id) on delete cascade,
  procedure_id text not null references public.randai_procedures(id) on delete restrict,
  procedure_version integer not null check (procedure_version > 0),
  procedure_snapshot jsonb not null,
  shared_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (group_message_id)
);
create index if not exists chat_procedure_links_group_created_idx on public.chat_procedure_links(group_id, created_at desc);
create index if not exists chat_procedure_links_procedure_idx on public.chat_procedure_links(procedure_id);
create index if not exists chat_procedure_links_shared_by_idx on public.chat_procedure_links(shared_by);
alter table public.chat_procedure_links enable row level security;
revoke insert, update, delete, truncate on public.chat_procedure_links from public, anon, authenticated;
grant select on public.chat_procedure_links to authenticated;
drop policy if exists chat_procedure_links_group_select on public.chat_procedure_links;
create policy chat_procedure_links_group_select on public.chat_procedure_links
for select to authenticated
using (public.chat_group_member(group_id, (select auth.uid())));

create or replace function public.chat_list_shareable_procedures(p_group_id uuid)
returns table(
  id text,
  title text,
  summary text,
  category text,
  procedure_kind text,
  risk_level text,
  version integer,
  caution text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
begin
  if not public.chat_group_member(p_group_id, v_user) then raise exception 'Gruppo non consentito'; end if;
  select g.hotel_id into v_hotel from public.chat_groups g where g.id = p_group_id;
  if v_hotel is null or not public.is_hotel_member(v_hotel, v_user) then
    raise exception 'Le procedure richiedono appartenenza alla struttura del gruppo';
  end if;
  return query
  select p.id,p.title,p.summary,p.category,p.procedure_kind,p.risk_level,p.version,p.caution
  from public.randai_procedures p
  where p.hotel_id=v_hotel and p.status='approved'
  order by p.risk_level desc,p.title;
end;
$$;

create or replace function public.chat_share_procedure(p_group_id uuid, p_procedure_id text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
  v_proc public.randai_procedures;
  v_message uuid;
  v_snapshot jsonb;
begin
  if not public.chat_group_member(p_group_id, v_user) then raise exception 'Gruppo non consentito'; end if;
  select g.hotel_id into v_hotel from public.chat_groups g where g.id=p_group_id and g.archived_at is null;
  if v_hotel is null or not public.is_hotel_member(v_hotel, v_user) then
    raise exception 'Condivisione procedura non consentita per questa struttura';
  end if;
  select * into v_proc from public.randai_procedures p
  where p.id=p_procedure_id and p.hotel_id=v_hotel and p.status='approved';
  if not found then raise exception 'Procedura approvata non trovata'; end if;

  v_snapshot := jsonb_build_object(
    'id',v_proc.id,'title',v_proc.title,'summary',v_proc.summary,'category',v_proc.category,
    'area',v_proc.area,'procedure_kind',v_proc.procedure_kind,'risk_level',v_proc.risk_level,
    'steps',coalesce(v_proc.steps,'[]'::jsonb),'caution',v_proc.caution,
    'source_label',v_proc.source_label,'version',v_proc.version,'approved_at',v_proc.approved_at
  );

  insert into public.chat_messages(group_id,sender_user_id,body)
  values (p_group_id,v_user,'📘 Procedura · ' || left(v_proc.title,200))
  returning id into v_message;

  insert into public.chat_procedure_links(group_id,group_message_id,procedure_id,procedure_version,procedure_snapshot,shared_by)
  values (p_group_id,v_message,v_proc.id,v_proc.version,v_snapshot,v_user);

  perform public.chat_write_audit(v_hotel,'procedure_shared','chat_group',p_group_id::text,
    jsonb_build_object('message_id',v_message,'procedure_id',v_proc.id,'procedure_version',v_proc.version),v_user);
  return v_message;
end;
$$;

create or replace function public.chat_list_group_procedures(p_group_id uuid)
returns table(
  group_message_id uuid,
  procedure_id text,
  procedure_version integer,
  procedure_snapshot jsonb,
  shared_by uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.chat_group_member(p_group_id, auth.uid()) then raise exception 'Gruppo non consentito'; end if;
  return query
  select l.group_message_id,l.procedure_id,l.procedure_version,l.procedure_snapshot,l.shared_by,l.created_at
  from public.chat_procedure_links l where l.group_id=p_group_id order by l.created_at;
end;
$$;

-- RandAI can read only a bounded operational group context and only when the
-- caller is both a group member and an actual member of the group's hotel.
create or replace function public.chat_group_ai_context(p_group_id uuid, p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_group public.chat_groups;
  v_limit integer := least(greatest(coalesce(p_limit,30),1),50);
  v_messages jsonb;
  v_procedures jsonb;
  v_issues jsonb;
begin
  if not public.chat_group_member(p_group_id,v_user) then raise exception 'Gruppo non consentito'; end if;
  select * into v_group from public.chat_groups where id=p_group_id and archived_at is null;
  if not found or not public.is_hotel_member(v_group.hotel_id,v_user) then
    raise exception 'RandAI richiede appartenenza alla struttura del gruppo';
  end if;

  select coalesce(jsonb_agg(x order by x->>'created_at'),'[]'::jsonb) into v_messages
  from (
    select jsonb_build_object(
      'id',m.id,'sender',coalesce(p.display_name,'Utente'),'body',left(m.body,4000),'created_at',m.created_at
    ) as x
    from public.chat_messages m
    left join public.profiles p on p.auth_user_id=m.sender_user_id
    where m.group_id=p_group_id
    order by m.created_at desc
    limit v_limit
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',l.group_message_id,'procedure_id',l.procedure_id,'version',l.procedure_version,
    'snapshot',l.procedure_snapshot
  ) order by l.created_at),'[]'::jsonb) into v_procedures
  from public.chat_procedure_links l where l.group_id=p_group_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',l.group_message_id,'issue_id',l.issue_id
  ) order by l.created_at),'[]'::jsonb) into v_issues
  from public.chat_issue_links l where l.source_type='group' and l.group_id=p_group_id;

  return jsonb_build_object(
    'group_id',v_group.id,'group_name',v_group.name,'hotel_id',v_group.hotel_id,
    'messages',v_messages,'procedures',v_procedures,'issue_links',v_issues
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RandMedia: one provider contract, private Supabase provider active now.
-- Telegram can later implement the same provider contract without schema/UI changes.
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit)
values ('randchat-media','randchat-media',false,20971520)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit;

create table if not exists public.chat_attachments (
  id uuid primary key,
  scope text not null check (scope in ('group','dm')),
  group_id uuid references public.chat_groups(id) on delete cascade,
  group_message_id uuid references public.chat_messages(id) on delete cascade,
  dm_thread_id uuid references public.chat_dm_threads(id) on delete cascade,
  dm_message_id uuid references public.chat_dm_messages(id) on delete cascade,
  storage_provider text not null default 'supabase' check (char_length(storage_provider) between 1 and 40),
  storage_path text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  content_type text,
  display_name text,
  encrypted boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint chat_attachment_source_shape check (
    (scope='group' and group_id is not null and group_message_id is not null and dm_thread_id is null and dm_message_id is null and encrypted=false)
    or
    (scope='dm' and dm_thread_id is not null and dm_message_id is not null and group_id is null and group_message_id is null and encrypted=true)
  ),
  constraint chat_attachment_name_length check (display_name is null or char_length(display_name) <= 255),
  unique(storage_provider,storage_path)
);
create index if not exists chat_attachments_group_idx on public.chat_attachments(group_id,group_message_id) where scope='group';
create index if not exists chat_attachments_dm_idx on public.chat_attachments(dm_thread_id,dm_message_id) where scope='dm';
create index if not exists chat_attachments_created_by_idx on public.chat_attachments(created_by);
alter table public.chat_attachments enable row level security;
revoke insert,update,delete,truncate on public.chat_attachments from public,anon,authenticated;
grant select on public.chat_attachments to authenticated;
drop policy if exists chat_attachments_scoped_select on public.chat_attachments;
create policy chat_attachments_scoped_select on public.chat_attachments
for select to authenticated
using (
  (scope='group' and public.chat_group_member(group_id,(select auth.uid())))
  or
  (scope='dm' and public.chat_dm_participant(dm_thread_id,(select auth.uid())))
);

create table if not exists public.chat_media_gc_queue (
  id uuid primary key default gen_random_uuid(),
  storage_provider text not null,
  storage_path text not null,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  unique(storage_provider,storage_path)
);
alter table public.chat_media_gc_queue enable row level security;
revoke all on public.chat_media_gc_queue from public,anon,authenticated;
grant select,insert,update,delete on public.chat_media_gc_queue to service_role;

create or replace function public.queue_chat_attachment_storage_cleanup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.chat_media_gc_queue(storage_provider,storage_path)
  values(old.storage_provider,old.storage_path)
  on conflict(storage_provider,storage_path) do update set queued_at=now();
  return old;
end;
$$;
drop trigger if exists chat_attachments_queue_storage_cleanup on public.chat_attachments;
create trigger chat_attachments_queue_storage_cleanup
before delete on public.chat_attachments
for each row execute function public.queue_chat_attachment_storage_cleanup();

create or replace function public.chat_media_path_allowed(p_path text,p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path=public as $$
declare p text[] := string_to_array(coalesce(p_path,''),'/');
begin
  if array_length(p,1) < 3 then return false; end if;
  if p[1]='group' then return public.chat_group_member(p[2]::uuid,p_user); end if;
  if p[1]='dm' then return public.chat_dm_participant(p[2]::uuid,p_user); end if;
  return false;
exception when invalid_text_representation then return false;
end;
$$;

-- Storage access is path-scoped to the chat membership. DM objects are ciphertext.
drop policy if exists randchat_media_select on storage.objects;
create policy randchat_media_select on storage.objects for select to authenticated
using (bucket_id='randchat-media' and public.chat_media_path_allowed(name,(select auth.uid())));
drop policy if exists randchat_media_insert on storage.objects;
create policy randchat_media_insert on storage.objects for insert to authenticated
with check (bucket_id='randchat-media' and public.chat_media_path_allowed(name,(select auth.uid())));
drop policy if exists randchat_media_delete on storage.objects;
create policy randchat_media_delete on storage.objects for delete to authenticated
using (bucket_id='randchat-media' and public.chat_media_path_allowed(name,(select auth.uid())));

create or replace function public.chat_register_group_attachment(
  p_id uuid,p_group_id uuid,p_message_id uuid,p_storage_path text,p_byte_size bigint,
  p_content_type text default null,p_display_name text default null
)
returns uuid
language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid();
begin
  if not public.chat_group_member(p_group_id,v_user) then raise exception 'Gruppo non consentito'; end if;
  if not exists(select 1 from public.chat_messages m where m.id=p_message_id and m.group_id=p_group_id and m.sender_user_id=v_user) then
    raise exception 'Allegato consentito solo sul proprio messaggio';
  end if;
  if p_byte_size not between 1 and 20971520 then raise exception 'Dimensione allegato non valida'; end if;
  if p_storage_path not like ('group/'||p_group_id::text||'/'||p_message_id::text||'/%') then raise exception 'Percorso media non valido'; end if;
  insert into public.chat_attachments(id,scope,group_id,group_message_id,storage_provider,storage_path,byte_size,content_type,display_name,encrypted,created_by)
  values(p_id,'group',p_group_id,p_message_id,'supabase',p_storage_path,p_byte_size,left(p_content_type,120),left(p_display_name,255),false,v_user);
  return p_id;
end;
$$;

-- V2 wraps the already tested Group-B sender in the same transaction. If any
-- attachment metadata is invalid, message + envelopes + metadata all roll back.
create or replace function public.chat_dm_send_message_v2(
  p_thread_id uuid,p_message_id uuid,p_sender_device_id uuid,p_ciphertext text,p_content_iv text,
  p_ephemeral_public_key_jwk jsonb,p_signature text,p_envelopes jsonb,p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path=public,auth,pg_catalog as $$
declare
  v_user uuid:=auth.uid();
  v_message uuid;
  v_count integer;
begin
  if jsonb_typeof(p_attachments)<>'array' then raise exception 'Allegati DM non validi'; end if;
  select jsonb_array_length(p_attachments) into v_count;
  if v_count > 4 then raise exception 'Massimo 4 allegati per messaggio'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_attachments) as x(id uuid,storage_path text,byte_size bigint)
    where x.id is null or x.byte_size not between 1 and 20971520
      or x.storage_path not like ('dm/'||p_thread_id::text||'/'||p_message_id::text||'/%')
  ) then raise exception 'Metadati allegato DM non validi'; end if;

  v_message:=public.chat_dm_send_message(p_thread_id,p_message_id,p_sender_device_id,p_ciphertext,p_content_iv,p_ephemeral_public_key_jwk,p_signature,p_envelopes);
  insert into public.chat_attachments(id,scope,dm_thread_id,dm_message_id,storage_provider,storage_path,byte_size,content_type,display_name,encrypted,created_by)
  select x.id,'dm',p_thread_id,p_message_id,'supabase',x.storage_path,x.byte_size,'application/octet-stream',null,true,v_user
  from jsonb_to_recordset(p_attachments) as x(id uuid,storage_path text,byte_size bigint);
  return v_message;
end;
$$;

-- Realtime attachment changes let the UI hydrate media without polling.
do $$ begin
  alter publication supabase_realtime add table public.chat_attachments;
exception when duplicate_object then null; end $$;

-- Reuse the existing trusted internal cron secret, under a RandChat-specific key.
insert into public.edge_function_secrets(key,value,updated_at)
select 'randchat_media_cron_secret',value,now()
from public.edge_function_secrets where key='reminder_cron_secret'
on conflict(key) do update set value=excluded.value,updated_at=now();

do $$ begin perform cron.unschedule('randchat-media-gc-hourly'); exception when others then null; end $$;
select cron.schedule(
  'randchat-media-gc-hourly','25 * * * *',
  $$select net.http_post(
    url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/randchat-media-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.edge_function_secrets where key='randchat_media_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );$$
);

-- Explicit ACLs: PostgreSQL otherwise grants EXECUTE to PUBLIC for new functions.
revoke all on function public.chat_list_shareable_procedures(uuid) from public,anon;
revoke all on function public.chat_share_procedure(uuid,text) from public,anon;
revoke all on function public.chat_list_group_procedures(uuid) from public,anon;
revoke all on function public.chat_group_ai_context(uuid,integer) from public,anon;
revoke all on function public.chat_media_path_allowed(text,uuid) from public,anon;
revoke all on function public.chat_register_group_attachment(uuid,uuid,uuid,text,bigint,text,text) from public,anon;
revoke all on function public.chat_dm_send_message_v2(uuid,uuid,uuid,text,text,jsonb,text,jsonb,jsonb) from public,anon;
revoke all on function public.queue_chat_attachment_storage_cleanup() from public,anon,authenticated;
grant execute on function public.chat_list_shareable_procedures(uuid) to authenticated;
grant execute on function public.chat_share_procedure(uuid,text) to authenticated;
grant execute on function public.chat_list_group_procedures(uuid) to authenticated;
grant execute on function public.chat_group_ai_context(uuid,integer) to authenticated;
grant execute on function public.chat_media_path_allowed(text,uuid) to authenticated,service_role;
grant execute on function public.chat_register_group_attachment(uuid,uuid,uuid,text,bigint,text,text) to authenticated;
grant execute on function public.chat_dm_send_message_v2(uuid,uuid,uuid,text,text,jsonb,text,jsonb,jsonb) to authenticated;
grant execute on function public.queue_chat_attachment_storage_cleanup() to service_role;

comment on table public.chat_procedure_links is 'Versioned snapshots of approved RandGuide procedures explicitly shared into operational RandChat groups.';
comment on table public.chat_attachments is 'RandMedia metadata. DM files are encrypted client-side; operational group files are access-controlled plaintext.';
comment on table public.chat_media_gc_queue is 'Server-only queue for deleting provider objects after chat retention or message deletion.';
