-- Final RandCore Runtime v2 database hardening.
-- Make runtime privileges explicit and prevent direct RPC claims by unknown workers.

revoke all on table public.randcore_events from anon, authenticated;
revoke all on table public.randcore_jobs from anon, authenticated;
revoke all on table public.randcore_workers from anon, authenticated;
revoke all on table public.randcore_dead_letters from anon, authenticated;

grant select, insert on table public.randcore_events to service_role;
grant select, insert, update on table public.randcore_jobs to service_role;
grant select, insert, update on table public.randcore_workers to service_role;
grant select, insert on table public.randcore_dead_letters to service_role;

create or replace function public.randcore_claim_job(
  p_job_id text,
  p_worker_id text,
  p_now bigint,
  p_lease_expires_at bigint
) returns public.randcore_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.randcore_jobs;
begin
  if not exists (
    select 1
      from public.randcore_workers
     where id = p_worker_id
  ) then
    raise exception 'RANDCORE_WORKER_NOT_REGISTERED';
  end if;

  update public.randcore_jobs
     set status = 'RUNNING',
         worker_id = p_worker_id,
         attempt = attempt + 1,
         lease_expires_at = p_lease_expires_at,
         updated_at = p_now
   where id = p_job_id
     and status in ('QUEUED', 'RETRYING')
  returning * into claimed;

  if claimed.id is null then
    raise exception 'RANDCORE_JOB_NOT_CLAIMABLE';
  end if;

  return claimed;
end;
$$;

revoke all on function public.randcore_claim_job(text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.randcore_claim_job(text, text, bigint, bigint) to service_role;
