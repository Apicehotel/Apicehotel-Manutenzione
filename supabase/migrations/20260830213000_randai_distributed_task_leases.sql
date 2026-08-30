alter table public.randai_tasks
  add column if not exists lease_owner text,
  add column if not exists lease_token uuid,
  add column if not exists lease_acquired_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

create index if not exists randai_tasks_lease_expiry_idx
  on public.randai_tasks(lease_expires_at)
  where lease_expires_at is not null;

create or replace function public.randai_claim_task(
  p_task_id text,
  p_lease_owner text,
  p_lease_seconds integer default 120
)
returns table(lease_token uuid, lease_expires_at timestamptz, revision integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hotel_id text;
  v_token uuid := gen_random_uuid();
  v_seconds integer := greatest(10, least(coalesce(p_lease_seconds, 120), 900));
begin
  if nullif(trim(p_lease_owner), '') is null then
    raise exception 'lease owner required';
  end if;

  select hotel_id into v_hotel_id from public.randai_tasks where id = p_task_id;
  if v_hotel_id is null then return; end if;

  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.can_admin_hotel(v_hotel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  update public.randai_tasks t
     set lease_owner = p_lease_owner,
         lease_token = v_token,
         lease_acquired_at = now(),
         lease_expires_at = now() + make_interval(secs => v_seconds),
         updated_at = now()
   where t.id = p_task_id
     and t.status not in ('SUCCEEDED','FAILED','CANCELLED')
     and (
       t.lease_expires_at is null
       or t.lease_expires_at <= now()
       or t.lease_owner = p_lease_owner
     )
  returning t.lease_token, t.lease_expires_at, t.revision;
end;
$$;

create or replace function public.randai_renew_task_lease(
  p_task_id text,
  p_lease_token uuid,
  p_lease_seconds integer default 120
)
returns table(lease_token uuid, lease_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hotel_id text;
  v_seconds integer := greatest(10, least(coalesce(p_lease_seconds, 120), 900));
begin
  select hotel_id into v_hotel_id from public.randai_tasks where id = p_task_id;
  if v_hotel_id is null then return; end if;
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.can_admin_hotel(v_hotel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  update public.randai_tasks t
     set lease_expires_at = now() + make_interval(secs => v_seconds),
         updated_at = now()
   where t.id = p_task_id
     and t.lease_token = p_lease_token
     and t.lease_expires_at > now()
  returning t.lease_token, t.lease_expires_at;
end;
$$;

create or replace function public.randai_release_task_lease(
  p_task_id text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hotel_id text;
  v_released boolean := false;
begin
  select hotel_id into v_hotel_id from public.randai_tasks where id = p_task_id;
  if v_hotel_id is null then return false; end if;
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.can_admin_hotel(v_hotel_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.randai_tasks
     set lease_owner = null,
         lease_token = null,
         lease_acquired_at = null,
         lease_expires_at = null,
         updated_at = now()
   where id = p_task_id
     and lease_token = p_lease_token;
  v_released := found;
  return v_released;
end;
$$;

revoke all on function public.randai_claim_task(text,text,integer) from public, anon;
revoke all on function public.randai_renew_task_lease(text,uuid,integer) from public, anon;
revoke all on function public.randai_release_task_lease(text,uuid) from public, anon;
grant execute on function public.randai_claim_task(text,text,integer) to authenticated, service_role;
grant execute on function public.randai_renew_task_lease(text,uuid,integer) to authenticated, service_role;
grant execute on function public.randai_release_task_lease(text,uuid) to authenticated, service_role;
