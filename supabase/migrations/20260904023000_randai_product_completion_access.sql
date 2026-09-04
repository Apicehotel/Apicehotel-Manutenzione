-- Product completion: let the dedicated RandAI control role read and trigger
-- the canonical RandCore health audit without broadening generic RandApp admin.

create or replace function public.has_randai_control_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.active = true
      and hm.can_access_admin = true
      and hm.role = 'RandAI'
  );
$$;

revoke all on function public.has_randai_control_access() from public, anon, authenticated;
grant execute on function public.has_randai_control_access() to service_role;

create or replace function public.randcore_get_health_history_randai(p_limit integer default 12)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 36));
  v_latest uuid;
begin
  if not public.has_randai_control_access() then raise exception 'not_authorized'; end if;
  select id into v_latest from public.randcore_health_checks order by created_at desc limit 1;
  return jsonb_build_object(
    'checks', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.randcore_health_checks order by created_at desc limit v_limit) c), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(f) order by case f.severity when 'CRITICAL' then 4 when 'HIGH' then 3 when 'WARN' then 2 else 1 end desc, f.id) from public.randcore_health_findings f where f.check_id = v_latest), '[]'::jsonb),
    'external_evidence', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.domain)
      from (
        select distinct on (domain) id, domain, status, score, source, checked_at, max_age_seconds, commit_sha, evidence, created_at
        from public.randcore_external_health_evidence
        order by domain, checked_at desc, id desc
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.randcore_run_health_check_randai()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.has_randai_control_access() then raise exception 'not_authorized'; end if;
  perform public.randcore_measure_integrations_internal();
  perform public.randcore_run_recoverability_drill_internal();
  perform public.randcore_run_health_check_internal('manual');
  return public.randcore_get_health_history_randai(12);
end;
$$;

revoke all on function public.randcore_get_health_history_randai(integer) from public, anon;
revoke all on function public.randcore_run_health_check_randai() from public, anon;
grant execute on function public.randcore_get_health_history_randai(integer) to authenticated, service_role;
grant execute on function public.randcore_run_health_check_randai() to authenticated, service_role;

