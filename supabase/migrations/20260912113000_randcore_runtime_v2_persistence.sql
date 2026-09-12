-- RandCore Runtime v2 persistent source of truth.
-- Server-side only: RLS is enabled and no client policies are granted.

create table if not exists public.randcore_events (
  event_id text primary key,
  type text not null,
  source text not null,
  scope text not null check (scope in ('HOTEL', 'SYSTEM')),
  hotel_id text null,
  occurred_at bigint not null,
  correlation_id text not null,
  causation_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint randcore_events_scope_hotel_ck check (
    (scope = 'HOTEL' and hotel_id is not null and btrim(hotel_id) <> '') or
    (scope = 'SYSTEM' and hotel_id is null)
  )
);

create index if not exists randcore_events_hotel_occurred_idx on public.randcore_events (hotel_id, occurred_at desc) where hotel_id is not null;
create index if not exists randcore_events_correlation_idx on public.randcore_events (correlation_id);

create table if not exists public.randcore_jobs (
  id text primary key,
  event_id text not null references public.randcore_events(event_id) on delete restrict,
  handler_id text not null,
  status text not null check (status in ('QUEUED','RUNNING','RETRYING','SUCCEEDED','FAILED','DEAD_LETTER','CANCELLED')),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  worker_id text null,
  durable_run_id text null,
  error_code text null,
  metadata jsonb not null default '{}'::jsonb,
  output jsonb null,
  lease_expires_at bigint null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists randcore_jobs_status_updated_idx on public.randcore_jobs (status, updated_at);
create index if not exists randcore_jobs_event_idx on public.randcore_jobs (event_id);
create index if not exists randcore_jobs_lease_idx on public.randcore_jobs (lease_expires_at) where status = 'RUNNING';

create table if not exists public.randcore_workers (
  id text primary key,
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  registered_at bigint not null,
  last_heartbeat_at bigint not null
);
create index if not exists randcore_workers_heartbeat_idx on public.randcore_workers (last_heartbeat_at);

create table if not exists public.randcore_dead_letters (
  id text primary key,
  job_id text not null references public.randcore_jobs(id) on delete restrict,
  event_id text not null references public.randcore_events(event_id) on delete restrict,
  handler_id text not null,
  reason text not null,
  error_code text null,
  attempts integer not null check (attempts >= 0),
  created_at bigint not null
);
create unique index if not exists randcore_dead_letters_job_reason_uidx on public.randcore_dead_letters (job_id, reason);

alter table public.randcore_events enable row level security;
alter table public.randcore_jobs enable row level security;
alter table public.randcore_workers enable row level security;
alter table public.randcore_dead_letters enable row level security;

create or replace function public.randcore_claim_job(p_job_id text, p_worker_id text, p_now bigint, p_lease_expires_at bigint)
returns public.randcore_jobs
language plpgsql security definer set search_path = public
as $$
declare claimed public.randcore_jobs;
begin
  update public.randcore_jobs
     set status='RUNNING', worker_id=p_worker_id, attempt=attempt+1,
         lease_expires_at=p_lease_expires_at, updated_at=p_now
   where id=p_job_id and status in ('QUEUED','RETRYING')
  returning * into claimed;
  if claimed.id is null then raise exception 'RANDCORE_JOB_NOT_CLAIMABLE'; end if;
  return claimed;
end;
$$;

create or replace function public.randcore_renew_job_lease(p_job_id text, p_worker_id text, p_now bigint, p_lease_expires_at bigint)
returns public.randcore_jobs
language plpgsql security definer set search_path = public
as $$
declare renewed public.randcore_jobs;
begin
  update public.randcore_jobs
     set lease_expires_at=p_lease_expires_at, updated_at=p_now
   where id=p_job_id and status='RUNNING' and worker_id=p_worker_id
     and lease_expires_at is not null and lease_expires_at > p_now
  returning * into renewed;
  if renewed.id is null then raise exception 'RANDCORE_LEASE_NOT_RENEWABLE'; end if;
  return renewed;
end;
$$;

create or replace function public.randcore_recover_expired_jobs(p_now bigint)
returns setof public.randcore_jobs
language plpgsql security definer set search_path = public
as $$
declare job public.randcore_jobs; recovered public.randcore_jobs;
begin
  for job in
    select * from public.randcore_jobs
     where status='RUNNING' and lease_expires_at is not null and lease_expires_at <= p_now
     for update skip locked
  loop
    if job.attempt < job.max_attempts then
      update public.randcore_jobs
         set status='RETRYING', worker_id=null, lease_expires_at=null,
             error_code='LEASE_EXPIRED', updated_at=p_now
       where id=job.id returning * into recovered;
    else
      update public.randcore_jobs
         set status='DEAD_LETTER', worker_id=null, lease_expires_at=null,
             error_code='LEASE_EXPIRED', updated_at=p_now
       where id=job.id returning * into recovered;
      insert into public.randcore_dead_letters
        (id,job_id,event_id,handler_id,reason,error_code,attempts,created_at)
      values
        ('dlq_lease_'||job.id,job.id,job.event_id,job.handler_id,
         'LEASE_EXPIRED_RETRY_EXHAUSTED','LEASE_EXPIRED',job.attempt,p_now)
      on conflict (job_id,reason) do nothing;
    end if;
    return next recovered;
  end loop;
  return;
end;
$$;

revoke all on function public.randcore_claim_job(text,text,bigint,bigint) from public, anon, authenticated;
revoke all on function public.randcore_renew_job_lease(text,text,bigint,bigint) from public, anon, authenticated;
revoke all on function public.randcore_recover_expired_jobs(bigint) from public, anon, authenticated;
grant execute on function public.randcore_claim_job(text,text,bigint,bigint) to service_role;
grant execute on function public.randcore_renew_job_lease(text,text,bigint,bigint) to service_role;
grant execute on function public.randcore_recover_expired_jobs(bigint) to service_role;
