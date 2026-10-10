-- Legacy technician_access_tokens: add TTL (revoke-only links had no expiry).
-- New/regenerated links set expires_at from admin-users; resolve rejects expired rows.

alter table public.technician_access_tokens
  add column if not exists expires_at timestamptz;

-- Existing active legacy links: 90-day window from creation (floor at now+7d so
-- recently created tokens are not instantly dead after migrate).
update public.technician_access_tokens
set expires_at = greatest(created_at + interval '90 days', now() + interval '7 days')
where expires_at is null
  and revoked_at is null
  and token like 'hash:%';

comment on column public.technician_access_tokens.expires_at is
  'Legacy personal tech-portal link expiry. Null or past = reject. Point-4 dispatch tokens use technician_dispatch_tokens.expires_at.';
