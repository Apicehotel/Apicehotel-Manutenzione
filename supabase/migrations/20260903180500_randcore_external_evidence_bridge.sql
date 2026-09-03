-- Block 72: bounded external evidence bridge for RandCore.
-- External evidence is append-only, service-role only and never turns UNKNOWN into HEALTHY without a fresh proof.
create table if not exists public.randcore_external_health_evidence (
  id bigint generated always as identity primary key,
  domain text not null check (domain in ('deploy','backup_restore','integrations','dependencies')),
  status text not null check (status in ('HEALTHY','DEGRADED','CRITICAL')),
  score integer not null check (score between 0 and 100),
  source text not null check (char_length(source) between 1 and 120),
  checked_at timestamptz not null,
  max_age_seconds integer not null check (max_age_seconds between 60 and 2678400),
  commit_sha text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists randcore_external_health_evidence_domain_checked_idx
  on public.randcore_external_health_evidence(domain, checked_at desc);

alter table public.randcore_external_health_evidence enable row level security;
revoke all on public.randcore_external_health_evidence from public, anon, authenticated, service_role;

create or replace function public.randcore_record_external_health_evidence(
  p_domain text,
  p_status text,
  p_score integer,
  p_source text,
  p_checked_at timestamptz,
  p_max_age_seconds integer,
  p_commit_sha text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id bigint;
begin
  if current_user not in ('postgres','service_role') and auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_domain not in ('deploy','backup_restore','integrations','dependencies') then raise exception 'invalid_external_health_domain'; end if;
  if p_status not in ('HEALTHY','DEGRADED','CRITICAL') then raise exception 'invalid_external_health_status'; end if;
  if p_score is null or p_score < 0 or p_score > 100 then raise exception 'invalid_external_health_score'; end if;
  if p_source is null or char_length(p_source) < 1 or char_length(p_source) > 120 then raise exception 'invalid_external_health_source'; end if;
  if p_checked_at is null or p_checked_at > now() + interval '5 minutes' then raise exception 'invalid_external_health_timestamp'; end if;
  if p_max_age_seconds is null or p_max_age_seconds < 60 or p_max_age_seconds > 2678400 then raise exception 'invalid_external_health_max_age'; end if;
  if p_commit_sha is not null and char_length(p_commit_sha) > 80 then raise exception 'invalid_external_health_commit'; end if;
  if pg_column_size(coalesce(p_evidence,'{}'::jsonb)) > 65536 then raise exception 'external_health_evidence_too_large'; end if;

  insert into public.randcore_external_health_evidence(domain,status,score,source,checked_at,max_age_seconds,commit_sha,evidence)
  values(p_domain,p_status,p_score,p_source,p_checked_at,p_max_age_seconds,nullif(p_commit_sha,''),coalesce(p_evidence,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.randcore_record_external_health_evidence(text,text,integer,text,timestamptz,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.randcore_record_external_health_evidence(text,text,integer,text,timestamptz,integer,text,jsonb) to service_role;

create or replace function public.randcore_get_health_history(p_limit integer default 12)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_limit integer := greatest(1,least(coalesce(p_limit,12),36));
  v_latest uuid;
begin
  if auth.uid() is null or not public.has_any_randapp_admin() then raise exception 'not_authorized'; end if;
  select id into v_latest from public.randcore_health_checks order by created_at desc limit 1;
  return jsonb_build_object(
    'checks',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.randcore_health_checks order by created_at desc limit v_limit) c),'[]'::jsonb),
    'findings',coalesce((select jsonb_agg(to_jsonb(f) order by case f.severity when 'CRITICAL' then 4 when 'HIGH' then 3 when 'WARN' then 2 else 1 end desc,f.id) from public.randcore_health_findings f where f.check_id=v_latest),'[]'::jsonb),
    'external_evidence',coalesce((
      select jsonb_agg(to_jsonb(e) order by e.domain)
      from (
        select distinct on (domain) id,domain,status,score,source,checked_at,max_age_seconds,commit_sha,evidence,created_at
        from public.randcore_external_health_evidence
        order by domain,checked_at desc,id desc
      ) e
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.randcore_get_health_history(integer) from public, anon;
grant execute on function public.randcore_get_health_history(integer) to authenticated, service_role;
