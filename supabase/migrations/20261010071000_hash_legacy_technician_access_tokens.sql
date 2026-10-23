-- Legacy technician_access_tokens must not store recoverable plaintext credentials.
-- Point-4 dispatch already uses technician_dispatch_tokens.token_hash.
-- Revoke any remaining plaintext/legacy rows so resolveLegacy only accepts hash:<sha256>.

create extension if not exists pgcrypto;

update public.technician_access_tokens
set revoked_at = coalesce(revoked_at, now()),
    token = 'revoked:' || encode(digest(token, 'sha256'), 'hex')
where token not like 'revoked:%'
  and token not like 'hash:%';

comment on table public.technician_access_tokens is
  'Legacy technician links. Active credentials are stored as hash:<sha256(token)>; revoked rows use revoked:<sha256>. New dispatches use technician_dispatch_tokens.token_hash.';
