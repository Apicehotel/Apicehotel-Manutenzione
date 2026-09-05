-- Group C RandMedia hardening.
-- 20 MiB is the user-facing plaintext limit; encrypted DM blobs need a small
-- provider-side headroom for the AES-GCM authentication tag.
update storage.buckets set file_size_limit=22020096 where id='randchat-media';

alter table public.chat_attachments drop constraint if exists chat_attachments_byte_size_check;
alter table public.chat_attachments add constraint chat_attachments_byte_size_check
  check (byte_size > 0 and byte_size <= 22020096);

-- Group uploads happen after the group message exists, so bind the path to that
-- concrete message. DM uploads happen before the atomic send RPC and are instead
-- protected by thread membership plus orphan GC below.
create or replace function public.chat_media_path_allowed(p_path text,p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path=public as $$
declare p text[] := string_to_array(coalesce(p_path,''),'/');
begin
  if p_user is null or array_length(p,1) < 3 then return false; end if;
  if p[1]='group' then
    if array_length(p,1) < 4 or not public.chat_group_member(p[2]::uuid,p_user) then return false; end if;
    return exists(select 1 from public.chat_messages m where m.id=p[3]::uuid and m.group_id=p[2]::uuid);
  end if;
  if p[1]='dm' then return public.chat_dm_participant(p[2]::uuid,p_user); end if;
  return false;
exception when invalid_text_representation then return false;
end;
$$;
revoke all on function public.chat_media_path_allowed(text,uuid) from public,anon;
grant execute on function public.chat_media_path_allowed(text,uuid) to authenticated,service_role;

-- Queue any provider object that never acquired DB metadata (browser closed,
-- network failed, send transaction rejected, etc.). A two-hour grace period
-- avoids racing a slow upload/send while guaranteeing eventual cleanup.
create or replace function public.queue_orphaned_chat_media()
returns integer
language plpgsql security definer set search_path=public,storage as $$
declare v_count integer;
begin
  insert into public.chat_media_gc_queue(storage_provider,storage_path)
  select 'supabase',o.name
  from storage.objects o
  left join public.chat_attachments a on a.storage_provider='supabase' and a.storage_path=o.name
  where o.bucket_id='randchat-media'
    and o.created_at < now()-interval '2 hours'
    and a.id is null
  on conflict(storage_provider,storage_path) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.queue_orphaned_chat_media() from public,anon,authenticated;
grant execute on function public.queue_orphaned_chat_media() to service_role;

-- Replace V2 only to allow encrypted-provider headroom. The client still caps
-- plaintext files at 20 MiB.
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
  if coalesce(jsonb_typeof(p_attachments),'null')<>'array' then raise exception 'Allegati DM non validi'; end if;
  select jsonb_array_length(p_attachments) into v_count;
  if v_count > 4 then raise exception 'Massimo 4 allegati per messaggio'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_attachments) as x(id uuid,storage_path text,byte_size bigint)
    where x.id is null or x.byte_size not between 1 and 22020096
      or x.storage_path not like ('dm/'||p_thread_id::text||'/'||p_message_id::text||'/%')
  ) then raise exception 'Metadati allegato DM non validi'; end if;

  v_message:=public.chat_dm_send_message(p_thread_id,p_message_id,p_sender_device_id,p_ciphertext,p_content_iv,p_ephemeral_public_key_jwk,p_signature,p_envelopes);
  insert into public.chat_attachments(id,scope,dm_thread_id,dm_message_id,storage_provider,storage_path,byte_size,content_type,display_name,encrypted,created_by)
  select x.id,'dm',p_thread_id,p_message_id,'supabase',x.storage_path,x.byte_size,'application/octet-stream',null,true,v_user
  from jsonb_to_recordset(p_attachments) as x(id uuid,storage_path text,byte_size bigint);
  return v_message;
end;
$$;
revoke all on function public.chat_dm_send_message_v2(uuid,uuid,uuid,text,text,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.chat_dm_send_message_v2(uuid,uuid,uuid,text,text,jsonb,text,jsonb,jsonb) to authenticated;
