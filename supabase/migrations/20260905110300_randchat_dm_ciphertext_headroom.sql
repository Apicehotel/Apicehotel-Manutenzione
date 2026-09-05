-- Group C compatibility hardening.
-- UI text remains capped at 8,000 characters. UTF-8, JSON media descriptors,
-- AES-GCM and base64 expansion need more server-side ciphertext headroom.

alter table public.chat_dm_messages
  drop constraint if exists chat_dm_message_ciphertext_length;
alter table public.chat_dm_messages
  add constraint chat_dm_message_ciphertext_length
  check (char_length(ciphertext) between 1 and 65536);

create or replace function public.chat_dm_send_message(
  p_thread_id uuid,
  p_message_id uuid,
  p_sender_device_id uuid,
  p_ciphertext text,
  p_content_iv text,
  p_ephemeral_public_key_jwk jsonb,
  p_signature text,
  p_envelopes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_retention smallint;
  v_active_count integer;
  v_active_users integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then raise exception 'Accesso DM non consentito'; end if;
  if p_message_id is null then raise exception 'message_id mancante'; end if;
  if char_length(coalesce(p_ciphertext,'')) not between 1 and 65536 then raise exception 'Ciphertext non valido'; end if;
  if char_length(coalesce(p_signature,'')) not between 16 and 1024 then raise exception 'Firma non valida'; end if;
  if coalesce(p_ephemeral_public_key_jwk->>'kty','') <> 'EC' or coalesce(p_ephemeral_public_key_jwk->>'crv','') <> 'P-256' then
    raise exception 'Chiave effimera non valida';
  end if;
  if jsonb_typeof(p_envelopes) <> 'array' then raise exception 'Envelope dispositivi non valide'; end if;

  select t.user_low,t.user_high,t.retention_days into v_low,v_high,v_retention
  from public.chat_dm_threads t where t.id=p_thread_id for update;

  if not exists (
    select 1 from public.chat_dm_devices d
    where d.id=p_sender_device_id and d.auth_user_id=v_user and d.revoked_at is null
  ) then raise exception 'Dispositivo mittente non registrato'; end if;

  select count(*)::integer,count(distinct d.auth_user_id)::integer
    into v_active_count,v_active_users
  from public.chat_dm_devices d
  where d.auth_user_id in (v_low,v_high) and d.revoked_at is null;

  if v_active_users < 2 then
    raise exception 'Il destinatario deve aprire RandChat almeno una volta prima di ricevere DM E2EE';
  end if;

  select count(*)::integer,count(distinct x.device_id)::integer
    into v_input_count,v_distinct_count
  from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text);

  if v_input_count <> v_active_count or v_distinct_count <> v_active_count then
    raise exception 'Ogni dispositivo attivo deve ricevere una envelope';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
    left join public.chat_dm_devices d on d.id=x.device_id and d.revoked_at is null and d.auth_user_id in (v_low,v_high)
    where d.id is null or char_length(coalesce(x.wrapped_key,'')) not between 16 and 4096 or char_length(coalesce(x.wrap_iv,'')) not between 8 and 128
  ) then raise exception 'Envelope dispositivo non valida'; end if;

  if exists (
    select 1 from public.chat_dm_devices d
    where d.auth_user_id in (v_low,v_high) and d.revoked_at is null
      and not exists (
        select 1 from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
        where x.device_id=d.id
      )
  ) then raise exception 'Envelope mancante per un dispositivo attivo'; end if;

  insert into public.chat_dm_messages(
    id,thread_id,sender_user_id,sender_device_id,ciphertext,content_iv,
    ephemeral_public_key_jwk,signature,expires_at
  ) values (
    p_message_id,p_thread_id,v_user,p_sender_device_id,p_ciphertext,p_content_iv,
    p_ephemeral_public_key_jwk,p_signature,now()+make_interval(days=>v_retention::integer)
  );

  insert into public.chat_dm_envelopes(message_id,device_row_id,recipient_user_id,wrapped_key,wrap_iv)
  select p_message_id,d.id,d.auth_user_id,x.wrapped_key,x.wrap_iv
  from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
  join public.chat_dm_devices d on d.id=x.device_id;

  update public.chat_dm_threads set updated_at=now() where id=p_thread_id;
  return p_message_id;
end;
$$;

revoke all on function public.chat_dm_send_message(uuid,uuid,uuid,text,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.chat_dm_send_message(uuid,uuid,uuid,text,text,jsonb,text,jsonb) to authenticated;
