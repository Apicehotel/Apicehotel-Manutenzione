create table if not exists public.admin_auth_attempts (
  source_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.admin_auth_attempts enable row level security;
revoke all privileges on table public.admin_auth_attempts from public, anon, authenticated;
grant all privileges on table public.admin_auth_attempts to service_role;

create index if not exists admin_auth_attempts_updated_idx on public.admin_auth_attempts(updated_at);

update public.utenti u
set pin = null
where pin is not null
  and exists (
    select 1
    from public.profiles p
    join public.auth_pin_credentials c on c.auth_user_id = p.auth_user_id
    where p.legacy_user_id = u.id
  );

create or replace function public.reject_legacy_pin_when_credential_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pin is not null and exists (
    select 1
    from public.profiles p
    join public.auth_pin_credentials c on c.auth_user_id = p.auth_user_id
    where p.legacy_user_id = new.id
  ) then
    new.pin := null;
  end if;
  return new;
end;
$$;
revoke all on function public.reject_legacy_pin_when_credential_exists() from public, anon, authenticated;
grant execute on function public.reject_legacy_pin_when_credential_exists() to service_role;

drop trigger if exists trg_reject_legacy_pin_when_credential_exists on public.utenti;
create trigger trg_reject_legacy_pin_when_credential_exists
before insert or update of pin on public.utenti
for each row execute function public.reject_legacy_pin_when_credential_exists();

drop policy if exists maintenance_photos_delete on storage.objects;
create policy maintenance_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'maintenance-photos'
  and (
    owner_id = auth.uid()::text
    or public.has_hotel_role((storage.foldername(name))[1], array['admin','Responsabile','manutentore'])
  )
);