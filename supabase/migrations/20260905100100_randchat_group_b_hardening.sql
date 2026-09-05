-- Group B hardening: keep device registration explicit and deterministic.
-- This replaces the initial implementation before rollout; no schema change.

create or replace function public.chat_dm_register_device(
  p_device_id uuid,
  p_encryption_public_key_jwk jsonb,
  p_signing_public_key_jwk jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.chat_dm_devices;
  v_device_row_id uuid;
begin
  if v_user is null or not public.chat_user_enabled(v_user) then
    raise exception 'RandChat non abilitata';
  end if;
  if p_device_id is null then raise exception 'device_id mancante'; end if;
  if coalesce(p_encryption_public_key_jwk->>'kty','') <> 'EC'
     or coalesce(p_encryption_public_key_jwk->>'crv','') <> 'P-256'
     or coalesce(p_signing_public_key_jwk->>'kty','') <> 'EC'
     or coalesce(p_signing_public_key_jwk->>'crv','') <> 'P-256' then
    raise exception 'Chiave dispositivo non valida';
  end if;

  select * into v_existing
  from public.chat_dm_devices
  where auth_user_id = v_user and device_id = p_device_id
  for update;

  if found then
    if v_existing.encryption_public_key_jwk is distinct from p_encryption_public_key_jwk
       or v_existing.signing_public_key_jwk is distinct from p_signing_public_key_jwk then
      raise exception 'Identità crittografica dispositivo non corrispondente';
    end if;
    update public.chat_dm_devices
    set last_seen_at = now(), revoked_at = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.chat_dm_devices(
    auth_user_id, device_id, encryption_public_key_jwk, signing_public_key_jwk
  ) values (
    v_user, p_device_id, p_encryption_public_key_jwk, p_signing_public_key_jwk
  ) returning id into v_device_row_id;

  return v_device_row_id;
end;
$$;

revoke all on function public.chat_dm_register_device(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.chat_dm_register_device(uuid,jsonb,jsonb) to authenticated;
