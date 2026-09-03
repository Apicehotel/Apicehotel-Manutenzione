-- Block 71: canonical seven-domain Health Evidence Contract.
-- The database-side audit can verify database/security/workers only.
-- The remaining domains stay UNKNOWN until a fresh external evidence source is merged.
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
  v_db_score integer := 100;
  v_security_score integer := 100;
  v_workers_score integer := 100;
  v_status text := 'DEGRADED';
  v_score integer := 100;
  v_checked_at timestamptz := now();
  v_id uuid;
  v_snapshot jsonb;
begin
  select count(*) into v_rls_disabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    and c.relname not in ('schema_migrations');

  select count(*) into v_anon_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where active=true' into v_cron_active;
  end if;
  if to_regclass('cron.job_run_details') is not null then
    execute 'select count(*) from cron.job_run_details where status <> ''succeeded'' and start_time >= now() - interval ''31 days''' into v_cron_failures;
  end if;

  if v_rls_disabled > 0 then v_db_score := greatest(0, 100 - least(25, v_rls_disabled * 2)); end if;
  if v_anon_definer > 0 then v_security_score := greatest(0, 100 - least(35, 10 + v_anon_definer)); end if;
  if v_cron_active = 0 then v_workers_score := v_workers_score - 10; end if;
  if v_cron_failures > 0 then v_workers_score := v_workers_score - least(15, v_cron_failures); end if;
  v_workers_score := greatest(0, least(100, v_workers_score));
  v_score := round((v_db_score + v_security_score + v_workers_score)::numeric / 3)::integer;

  if v_anon_definer > 0 then
    v_status := 'CRITICAL';
  elsif v_rls_disabled > 0 or v_cron_active = 0 or v_cron_failures > 0 then
    v_status := 'DEGRADED';
  else
    -- Four domains are intentionally UNKNOWN in a database-only check.
    -- Incomplete verified coverage must never be advertised as HEALTHY.
    v_status := 'DEGRADED';
  end if;

  v_snapshot := jsonb_build_object(
    'version', 2,
    'generated_at', v_checked_at,
    'status', v_status,
    'score', v_score,
    'confidence', 43,
    'coverage', jsonb_build_object(
      'evaluated_domains', 7,
      'verified_domains', 3,
      'measured_domains', 3,
      'stale_domains', 0,
      'unknown_domains', 4,
      'total_domains', 7,
      'verified_percent', 43
    ),
    'domains', jsonb_build_object(
      'database', jsonb_build_object(
        'state','VERIFIED','status',case when v_rls_disabled > 0 then 'DEGRADED' else 'HEALTHY' end,
        'score',v_db_score,'checked_at',v_checked_at,'confidence',100,'source','supabase-runtime',
        'evidence',jsonb_build_object('rls_disabled_tables',v_rls_disabled)
      ),
      'security', jsonb_build_object(
        'state','VERIFIED','status',case when v_anon_definer > 0 then 'CRITICAL' else 'HEALTHY' end,
        'score',v_security_score,'checked_at',v_checked_at,'confidence',100,'source','supabase-runtime',
        'evidence',jsonb_build_object('anon_security_definer_executable',v_anon_definer)
      ),
      'workers', jsonb_build_object(
        'state','VERIFIED','status',case when v_cron_active = 0 or v_cron_failures > 0 then 'DEGRADED' else 'HEALTHY' end,
        'score',v_workers_score,'checked_at',v_checked_at,'confidence',100,'source','supabase-runtime',
        'evidence',jsonb_build_object('active_jobs',v_cron_active,'failures_31d',v_cron_failures)
      ),
      'deploy', jsonb_build_object('state','UNKNOWN','status','UNKNOWN','confidence',0),
      'backup_restore', jsonb_build_object('state','UNKNOWN','status','UNKNOWN','confidence',0),
      'integrations', jsonb_build_object('state','UNKNOWN','status','UNKNOWN','confidence',0),
      'dependencies', jsonb_build_object('state','UNKNOWN','status','UNKNOWN','confidence',0)
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
