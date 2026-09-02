create table if not exists public.randai_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null,
  hotel_id text null,
  trigger_type text not null default 'scheduled',
  status text not null check (status in ('running','success','error','skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  duration_ms integer null,
  processed_count integer not null default 0,
  error_count integer not null default 0,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists randai_worker_runs_worker_started_idx on public.randai_worker_runs(worker_key, started_at desc);
create index if not exists randai_worker_runs_hotel_started_idx on public.randai_worker_runs(hotel_id, started_at desc) where hotel_id is not null;

alter table public.randai_worker_runs enable row level security;
revoke all on public.randai_worker_runs from anon, authenticated;
grant select, insert, update on public.randai_worker_runs to service_role;

create or replace function public.randai_control_snapshot(p_hotel_id text default null, p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_uid uuid := auth.uid();
  v_hotels text[];
  v_hours integer := greatest(1, least(coalesce(p_hours,24), 168));
  v_since timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours,24),168)));
  v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select array_agg(hotel_id order by hotel_id) into v_hotels
  from public.hotel_memberships
  where auth_user_id=v_uid and active=true and can_access_admin=true;

  if coalesce(array_length(v_hotels,1),0)=0 then raise exception 'admin_membership_required'; end if;
  if p_hotel_id is not null and not (p_hotel_id = any(v_hotels)) then raise exception 'hotel_scope_denied'; end if;

  with scoped_hotels as (
    select unnest(case when p_hotel_id is null then v_hotels else array[p_hotel_id] end) hotel_id
  ), worker_rows as (
    select j.jobid,j.jobname,j.schedule,j.active,
      (select jsonb_build_object('runid',r.runid,'status',r.status,'return_message',left(coalesce(r.return_message,''),500),'start_time',r.start_time,'end_time',r.end_time)
       from cron.job_run_details r where r.jobid=j.jobid order by r.start_time desc nulls last limit 1) last_run,
      (select count(*) from cron.job_run_details r where r.jobid=j.jobid and r.start_time>=v_since and lower(coalesce(r.status,'')) not in ('succeeded','success')) recent_failures
    from cron.job j
    where j.active=true
  ), audit_rows as (
    select jsonb_build_object('id',id,'source','operational','hotel_id',hotel_id,'time',created_at,'module',module,'action',action,'status',outcome,'record_type',record_type,'record_id',record_id,'actor_role',actor_role) item, created_at
    from public.operational_audit_log where hotel_id in (select hotel_id from scoped_hotels)
    union all
    select jsonb_build_object('id',id,'source','randai_action','hotel_id',hotel_id,'time',created_at,'module','randai','action',action_type,'status',status,'record_type',resource_type,'record_id',resource_id,'actor_role',actor_role) item, created_at
    from public.randai_action_audit where hotel_id in (select hotel_id from scoped_hotels)
  ), anomaly_rows as (
    select jsonb_build_object('kind','worker_failure','severity','high','hotel_id',null,'label',j.jobname,'detail',left(coalesce(r.return_message,r.status),500),'time',r.start_time) item
      from cron.job_run_details r join cron.job j on j.jobid=r.jobid
      where r.start_time>=v_since and lower(coalesce(r.status,'')) not in ('succeeded','success')
    union all
    select jsonb_build_object('kind','whatsapp_blocked','severity',case when processing_status='error' then 'high' else 'medium' end,'hotel_id',hotel_id,'label',processing_status,'detail',left(coalesce(body,''),220),'time',received_at)
      from public.whatsapp_inbound_messages where hotel_id in (select hotel_id from scoped_hotels) and processing_status in ('error','needs_info') and received_at>=v_since
    union all
    select jsonb_build_object('kind','knowledge_gap','severity',case when priority in ('critical','high','alta','critica') then 'high' else 'medium' end,'hotel_id',hotel_id,'label',coalesce(question,'Knowledge gap'),'detail',left(coalesce(context,''),220),'time',created_at)
      from public.randai_knowledge_gaps where hotel_id in (select hotel_id from scoped_hotels) and status not in ('resolved','closed','archived')
    union all
    select jsonb_build_object('kind','action_failure','severity','high','hotel_id',hotel_id,'label',action_type,'detail',coalesce(error_code,reason,status),'time',created_at)
      from public.randai_action_audit where hotel_id in (select hotel_id from scoped_hotels) and status in ('failed','error','rejected','denied') and created_at>=v_since
  ), trace_usage as (
    select
      count(*)::int trace_count,
      coalesce(sum(case when coalesce(trace #>> '{usage,input_tokens}','') ~ '^[0-9]+$' then (trace #>> '{usage,input_tokens}')::bigint else 0 end),0)::bigint input_tokens,
      coalesce(sum(case when coalesce(trace #>> '{usage,output_tokens}','') ~ '^[0-9]+$' then (trace #>> '{usage,output_tokens}')::bigint else 0 end),0)::bigint output_tokens,
      coalesce(sum(case when coalesce(trace->>'cost_usd','') ~ '^[0-9]+([.][0-9]+)?$' then (trace->>'cost_usd')::numeric else 0 end),0) cost_usd,
      bool_or(coalesce(trace->>'cost_usd','') ~ '^[0-9]+([.][0-9]+)?$') has_cost
    from public.randai_observability_traces where started_at>=v_since
  )
  select jsonb_build_object(
    'generated_at',now(),
    'hours',v_hours,
    'scope_hotels',(select coalesce(jsonb_agg(hotel_id order by hotel_id),'[]'::jsonb) from scoped_hotels),
    'cron_timezone',coalesce(current_setting('cron.timezone',true),'UTC'),
    'workers',(select coalesce(jsonb_agg(jsonb_build_object('jobid',jobid,'jobname',jobname,'schedule',schedule,'active',active,'last_run',last_run,'recent_failures',recent_failures) order by jobname),'[]'::jsonb) from worker_rows),
    'worker_heartbeats',(select coalesce(jsonb_agg(to_jsonb(w) order by w.started_at desc),'[]'::jsonb) from (select * from public.randai_worker_runs where (hotel_id is null or hotel_id in (select hotel_id from scoped_hotels)) and started_at>=v_since order by started_at desc limit 100) w),
    'rules',jsonb_build_object(
      'gateway',(select coalesce(jsonb_agg(jsonb_build_object('hotel_id',s.hotel_id,'enabled',s.enabled,'auto_execute_low_risk',s.auto_execute_low_risk,'updated_at',s.updated_at) order by s.hotel_id),'[]'::jsonb) from public.randai_action_gateway_settings s where s.hotel_id in (select hotel_id from scoped_hotels)),
      'autonomy',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'level',level,'max_risk',max_risk,'allowed_tools',allowed_tools,'denied_tools',denied_tools,'updated_at',updated_at) order by id),'[]'::jsonb) from public.randai_autonomy_policies)
    ),
    'knowledge',jsonb_build_object(
      'approved',(select count(*) from public.randai_procedures where hotel_id in (select hotel_id from scoped_hotels) and status='approved'),
      'draft',(select count(*) from public.randai_procedures where hotel_id in (select hotel_id from scoped_hotels) and status='draft'),
      'gaps_open',(select count(*) from public.randai_knowledge_gaps where hotel_id in (select hotel_id from scoped_hotels) and status not in ('resolved','closed','archived'))
    ),
    'anomalies',(select coalesce(jsonb_agg(item order by (item->>'time') desc),'[]'::jsonb) from anomaly_rows),
    'audit',(select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) from (select * from audit_rows order by created_at desc limit 200) a),
    'observability',(select jsonb_build_object('trace_count',trace_count,'input_tokens',input_tokens,'output_tokens',output_tokens,'cost_usd',case when has_cost then cost_usd else null end,'cost_available',coalesce(has_cost,false)) from trace_usage),
    'evals',jsonb_build_object('recent',(select count(*) from public.randai_eval_runs where created_at>=v_since),'failed',(select count(*) from public.randai_eval_runs where created_at>=v_since and coalesce(passed,false)=false)),
    'supervisor',jsonb_build_object('recent',(select count(*) from public.randai_supervisor_runs where created_at>=v_since),'errors',(select count(*) from public.randai_supervisor_runs where created_at>=v_since and status in ('error','failed')))
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.randai_control_snapshot(text,integer) from public,anon;
grant execute on function public.randai_control_snapshot(text,integer) to authenticated;

create or replace function public.randai_retry_worker(p_jobname text)
returns jsonb
language plpgsql
security definer
set search_path = public, cron, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_command text;
  v_request_id bigint;
  v_operation_id text := 'randai-worker-retry-' || gen_random_uuid()::text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.hotel_memberships where auth_user_id=v_uid and active=true and can_access_admin=true) then raise exception 'admin_membership_required'; end if;
  if p_jobname not in ('weather-alert-worker-2h-daytime','sync-sensori-temperatura-secure') then raise exception 'worker_retry_not_allowed'; end if;
  select command into v_command from cron.job where jobname=p_jobname and active=true;
  if v_command is null then raise exception 'worker_not_active'; end if;
  execute v_command into v_request_id;
  insert into public.operational_audit_log(operation_id,hotel_id,actor_user_id,actor_role,module,action,record_type,record_id,source,outcome,metadata)
  select v_operation_id,m.hotel_id,v_uid,m.role,'randai_control','worker_retry','worker',p_jobname,'randai_control','submitted',jsonb_build_object('request_id',v_request_id)
  from public.hotel_memberships m where m.auth_user_id=v_uid and m.active=true and m.can_access_admin=true order by m.hotel_id limit 1;
  return jsonb_build_object('ok',true,'jobname',p_jobname,'request_id',v_request_id,'submitted_at',now());
end;
$$;

revoke all on function public.randai_retry_worker(text) from public,anon;
grant execute on function public.randai_retry_worker(text) to authenticated;
