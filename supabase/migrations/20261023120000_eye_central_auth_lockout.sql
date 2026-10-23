begin;

create table if not exists eye_supremo.eye_central_auth_attempts (
  username text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on eye_supremo.eye_central_auth_attempts from public, anon, authenticated;
grant select, insert, update, delete on eye_supremo.eye_central_auth_attempts to service_role;

commit;
