create extension if not exists pgcrypto;

update public.technician_access_tokens
set revoked_at = coalesce(revoked_at, now()),
    token = 'revoked:' || encode(digest(token, 'sha256'), 'hex')
where token not like 'revoked:%';

comment on table public.technician_access_tokens is 'Legacy technician links: all pre-Point-4 credentials are revoked and irreversibly replaced with hashes. New dispatches use technician_dispatch_tokens.token_hash.';
