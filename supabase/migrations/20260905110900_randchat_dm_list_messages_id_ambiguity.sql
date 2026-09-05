-- Fix PL/pgSQL output-column ambiguity in chat_dm_list_messages.
-- The function RETURNS TABLE(... id uuid ...), so an unqualified `where id = ...`
-- conflicts with the output variable named `id`. Always qualify table columns.

create or replace function public.chat_dm_list_messages(
  p_thread_id uuid,
  p_device_id uuid,
  p_limit integer default 120
)
returns table(
  id uuid,
  thread_id uuid,
  sender_user_id uuid,
  sender_device_id uuid,
  ciphertext text,
  content_iv text,
  ephemeral_public_key_jwk jsonb,
  signature text,
  created_at timestamptz,
  expires_at timestamptz,
  wrapped_key text,
  wrap_iv text,
  sender_signing_public_key_jwk jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_device_row uuid;
  v_limit integer := least(greatest(coalesce(p_limit,120),1),300);
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then
    raise exception 'Accesso DM non consentito';
  end if;

  select d.id into v_device_row
  from public.chat_dm_devices d
  where d.auth_user_id = v_user
    and d.device_id = p_device_id
    and d.revoked_at is null;

  if v_device_row is null then
    raise exception 'Dispositivo locale non registrato';
  end if;

  update public.chat_dm_devices d
  set last_seen_at = now()
  where d.id = v_device_row;

  return query
  select
    q.id,
    q.thread_id,
    q.sender_user_id,
    q.sender_device_id,
    q.ciphertext,
    q.content_iv,
    q.ephemeral_public_key_jwk,
    q.signature,
    q.created_at,
    q.expires_at,
    e.wrapped_key,
    e.wrap_iv,
    sd.signing_public_key_jwk
  from (
    select m.*
    from public.chat_dm_messages m
    where m.thread_id = p_thread_id
      and m.expires_at > now()
    order by m.created_at desc
    limit v_limit
  ) q
  left join public.chat_dm_envelopes e
    on e.message_id = q.id
   and e.device_row_id = v_device_row
  join public.chat_dm_devices sd
    on sd.id = q.sender_device_id
  order by q.created_at asc;
end;
$$;

revoke all on function public.chat_dm_list_messages(uuid,uuid,integer) from public, anon;
grant execute on function public.chat_dm_list_messages(uuid,uuid,integer) to authenticated;

comment on function public.chat_dm_list_messages(uuid,uuid,integer)
is 'Lists DM ciphertext for the local registered device. Table columns are explicitly qualified to avoid PL/pgSQL RETURNS TABLE name ambiguity.';
