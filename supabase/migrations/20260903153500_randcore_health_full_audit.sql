create table if not exists public.randcore_health_checks (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('manual','scheduled','ci')),
  status text not null check (status in ('HEALTHY','DEGRADED','CRITICAL','UNKNOWN')),
  score integer not null check (score between 0 and 100),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.randcore_health_findings (
  id bigint generated always as identity primary key,
  check_id uuid not null references public.randcore_health_checks(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('INFO','WARN','HIGH','CRITICAL')),
  code text not null,
  title text not null,
  detail text,
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create index if not exists randcore_health_checks_created_idx on public.randcore_health_checks(created_at desc);
create index if not exists randcore_health_findings_check_idx on public.randcore_health_findings(check_id);
create unique index if not exists randcore_health_findings_fingerprint_idx on public.randcore_health_findings(check_id,fingerprint);

alter table public.randcore_health_checks enable row level security;
alter table public.randcore_health_findings enable row level security;

revoke all on public.randcore_health_checks from anon, authenticated;
revoke all on public.randcore_health_findings from anon, authenticated;
grant select on public.randcore_health_checks to authenticated;
grant select on public.randcore_health_findings to authenticated;

create policy randcore_health_checks_admin_read on public.randcore_health_checks
for select to authenticated using (public.has_any_randapp_admin());

create policy randcore_health_findings_admin_read on public.randcore_health_findings
for select to authenticated using (public.has_any_randapp_admin());

create or replace function public.randcore_run_health_check_internal(p_source text default 'scheduled')
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_source text := case when p_source in ('manual','scheduled','ci') then p_source else 'scheduled' end;
  v_rls_disabled integer := 0;
  v_anon_definer integer := 0;
  v_cron_active integer := 0;
  v_cron_failures integer := 0;
  v_status text := 'HEALTHY';
  v_score integer := 100;
  v_id uuid;
  v_snapshot jsonb;
begin
  select count(*) into v_rls_disabled
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
    and c.relname not in ('schema_migrations');

  select count(*) into v_anon_definer
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where active=true' into v_cron_active;
  end if;
  if to_regclass('cron.job_run_details') is not null then
    execute 'select count(*) from cron.job_run_details where status <> ''succeeded'' and start_time >= now() - interval ''31 days''' into v_cron_failures;
  end if;

  if v_anon_definer > 0 then v_status := 'CRITICAL'; v_score := v_score - least(35, 10 + v_anon_definer); end if;
  if v_rls_disabled > 0 then if v_status <> 'CRITICAL' then v_status := 'DEGRADED'; end if; v_score := v_score - least(25, v_rls_disabled * 2); end if;
  if v_cron_active = 0 then if v_status='HEALTHY' then v_status := 'DEGRADED'; end if; v_score := v_score - 10; end if;
  if v_cron_failures > 0 then if v_status='HEALTHY' then v_status := 'DEGRADED'; end if; v_score := v_score - least(15, v_cron_failures); end if;
  v_score := greatest(0, least(100, v_score));

  v_snapshot := jsonb_build_object(
    'version',1,
    'coverage',jsonb_build_object('measured_domains',3,'total_domains',7),
    'domains',jsonb_build_object(
      'database',jsonb_build_object('state','MEASURED','rls_disabled_tables',v_rls_disabled),
      'security',jsonb_build_object('state','MEASURED','anon_security_definer_executable',v_anon_definer),
      'workers',jsonb_build_object('state','MEASURED','active_jobs',v_cron_active,'failures_31d',v_cron_failures),
      'deploy',jsonb_build_object('state','UNKNOWN'),
      'backup_restore',jsonb_build_object('state','UNKNOWN'),
      'integrations',jsonb_build_object('state','UNKNOWN'),
      'dependencies',jsonb_build_object('state','UNKNOWN')
    )
  );

  insert into public.randcore_health_checks(source,status,score,snapshot)
  values(v_source,v_status,v_score,v_snapshot) returning id into v_id;

  if v_anon_definer > 0 then
    insert into public.randcore_health_findings(check_id,category,severity,code,title,detail,fingerprint)
    values(v_id,'security','CRITICAL','ANON_SECURITY_DEFINER_EXECUTABLE','SECURITY DEFINER eseguibili da anon',v_anon_definer||' funzioni pubbliche richiedono revisione ACL.','security:anon-security-definer');
  end if;
  if v_rls_disabled > 0 then
    insert into public.randcore_health_findings(check_id,category,severity,code,title,detail,fingerprint)
    values(v_id,'database','HIGH','RLS_DISABLED_PUBLIC_TABLES','Tabelle public senza RLS',v_rls_disabled||' tabelle public risultano senza RLS.','database:rls-disabled');
  end if;
  if v_cron_active = 0 then
    insert into public.randcore_health_findings(check_id,category,severity,code,title,detail,fingerprint)
    values(v_id,'workers','WARN','NO_ACTIVE_CRON_JOBS','Nessun worker pg_cron attivo','Lo scheduler non espone job attivi.','workers:no-active-cron');
  end if;
  if v_cron_failures > 0 then
    insert into public.randcore_health_findings(check_id,category,severity,code,title,detail,fingerprint)
    values(v_id,'workers','WARN','CRON_FAILURES_31D','Worker con errori recenti',v_cron_failures||' esecuzioni non riuscite negli ultimi 31 giorni.','workers:cron-failures');
  end if;

  return v_id;
end;
$$;

revoke all on function public.randcore_run_health_check_internal(text) from public, anon, authenticated;
grant execute on function public.randcore_run_health_check_internal(text) to service_role;

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
    'findings',coalesce((select jsonb_agg(to_jsonb(f) order by case f.severity when 'CRITICAL' then 4 when 'HIGH' then 3 when 'WARN' then 2 else 1 end desc,f.id) from public.randcore_health_findings f where f.check_id=v_latest),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.randcore_get_health_history(integer) from public, anon;
grant execute on function public.randcore_get_health_history(integer) to authenticated, service_role;

create or replace function public.randcore_run_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or not public.has_any_randapp_admin() then raise exception 'not_authorized'; end if;
  perform public.randcore_run_health_check_internal('manual');
  return public.randcore_get_health_history(12);
end;
$$;

revoke all on function public.randcore_run_health_check() from public, anon;
grant execute on function public.randcore_run_health_check() to authenticated, service_role;

create or replace function public.randcore_record_ci_health_check(p_status text,p_score integer,p_snapshot jsonb,p_findings jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  if current_user not in ('postgres','service_role') and auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('HEALTHY','DEGRADED','CRITICAL','UNKNOWN') or p_score < 0 or p_score > 100 then raise exception 'invalid_health_payload'; end if;
  if pg_column_size(p_snapshot) > 262144 or pg_column_size(p_findings) > 262144 then raise exception 'health_payload_too_large'; end if;
  insert into public.randcore_health_checks(source,status,score,snapshot) values('ci',p_status,p_score,coalesce(p_snapshot,'{}'::jsonb)) returning id into v_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_findings,'[]'::jsonb)) loop
    insert into public.randcore_health_findings(check_id,category,severity,code,title,detail,fingerprint)
    values(v_id,coalesce(v_item->>'category','ci'),case when v_item->>'severity' in ('INFO','WARN','HIGH','CRITICAL') then v_item->>'severity' else 'INFO' end,coalesce(v_item->>'code','CI_FINDING'),coalesce(v_item->>'title','CI finding'),v_item->>'detail',coalesce(v_item->>'fingerprint',md5(v_item::text))) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.randcore_record_ci_health_check(text,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.randcore_record_ci_health_check(text,integer,jsonb,jsonb) to service_role;

-- Monthly database/runtime audit. One execution per month; no polling worker.
do $$
declare v_job bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    for v_job in select jobid from cron.job where jobname='randcore-monthly-full-check' loop perform cron.unschedule(v_job); end loop;
    perform cron.schedule('randcore-monthly-full-check','30 5 1 * *','select public.randcore_run_health_check_internal(''scheduled'');');
  end if;
end $$;
