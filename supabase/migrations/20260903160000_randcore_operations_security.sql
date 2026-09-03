create table if not exists public.randcore_worker_registry (
  jobname text primary key,
  purpose text not null,
  owner_module text not null,
  kind text not null check (kind in ('cron','edge','event')),
  event_driven boolean not null default false,
  pauseable boolean not null default false,
  retryable boolean not null default false,
  cost_class text not null default 'LOW' check (cost_class in ('LOW','MEDIUM','HIGH','UNKNOWN')),
  expected_schedule text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.randcore_worker_registry enable row level security;
revoke all on table public.randcore_worker_registry from anon, authenticated;
grant all on table public.randcore_worker_registry to service_role;

insert into public.randcore_worker_registry(jobname,purpose,owner_module,kind,event_driven,pauseable,retryable,cost_class,expected_schedule,notes)
values
('pulisci-richieste-urgenti-72h','Pulizia richieste urgenti oltre 72 ore','RandApp','cron',false,true,false,'LOW','0 * * * *','Retention operativa.'),
('presence-auto-expire-7h20','Scadenza automatica presenza oltre 7h20','RandApp','cron',false,true,false,'LOW','*/5 * * * *','Precisione al minuto non necessaria; check ogni 5 minuti.'),
('diagnostic-retention-daily','Retention eventi diagnostici oltre 30 giorni','RandCore','cron',false,true,false,'LOW','17 3 * * *','Pulizia giornaliera.'),
('weather-alert-worker-2h-daytime','Allerte meteo diurne','RandApp','edge',false,true,true,'MEDIUM','0 5,7,9,11,13,15,17,19 * * *','UTC; equivale a 07–21 locali in ora legale.'),
('sync-sensori-temperatura-secure','Sincronizzazione sensori temperatura','RandApp','edge',false,true,true,'MEDIUM','*/30 * * * *','Ogni 30 minuti.'),
('randcore-monthly-full-check','Audit completo mensile RandCore','RandCore','cron',false,false,false,'LOW','30 5 1 * *','Controllo mensile canonico.'),
('reminder-worker-1m','Promemoria attivi','RandApp','event',true,false,false,'MEDIUM','* * * * *','Esiste solo quando ci sono promemoria attivi.'),
('urgent-reminder-worker-30s','Promemoria urgenti temporanei','RandApp','event',true,false,false,'MEDIUM','30 seconds','Esiste solo mentre la coda urgente contiene elementi pending.')
on conflict(jobname) do update set
  purpose=excluded.purpose,owner_module=excluded.owner_module,kind=excluded.kind,event_driven=excluded.event_driven,
  pauseable=excluded.pauseable,retryable=excluded.retryable,cost_class=excluded.cost_class,
  expected_schedule=excluded.expected_schedule,notes=excluded.notes,updated_at=now();

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='presence-auto-expire-7h20' limit 1;
  if v_jobid is not null then
    perform cron.alter_job(v_jobid,'*/5 * * * *',null,null,null,null);
  end if;
end $$;

-- Hardening mirato: trigger/cron interni non devono essere invocabili da client.
revoke execute on function public.ensure_urgent_reminder_worker() from public, anon, authenticated;
revoke execute on function public.inventory_guard_intervention_delete() from public, anon, authenticated;
revoke execute on function public.run_urgent_reminder_tick() from public, anon, authenticated;
revoke execute on function public.sync_reminder_worker_cron() from public, anon, authenticated;
revoke execute on function public.sync_technician_dispatch_on_issue_close() from public, anon, authenticated;
revoke execute on function public.trg_sync_reminder_worker_cron() from public, anon, authenticated;
grant execute on function public.ensure_urgent_reminder_worker() to service_role;
grant execute on function public.inventory_guard_intervention_delete() to service_role;
grant execute on function public.run_urgent_reminder_tick() to service_role;
grant execute on function public.sync_reminder_worker_cron() to service_role;
grant execute on function public.sync_technician_dispatch_on_issue_close() to service_role;
grant execute on function public.trg_sync_reminder_worker_cron() to service_role;

-- RPC tecnici: solo utenti autenticati/service role; anon e PUBLIC non servono.
revoke execute on function public.technician_authorize_external(uuid,uuid,text,integer) from public, anon;
revoke execute on function public.technician_manage_directory(text,uuid,text,text,text,text,text,boolean) from public, anon;
revoke execute on function public.technician_membership_role(text) from public, anon;
revoke execute on function public.technician_reject_external(uuid,text) from public, anon;
revoke execute on function public.technician_request_external(text,uuid,text) from public, anon;
revoke execute on function public.technician_set_competencies(text,uuid,uuid[]) from public, anon;
grant execute on function public.technician_authorize_external(uuid,uuid,text,integer) to authenticated, service_role;
grant execute on function public.technician_manage_directory(text,uuid,text,text,text,text,text,boolean) to authenticated, service_role;
grant execute on function public.technician_membership_role(text) to authenticated, service_role;
grant execute on function public.technician_reject_external(uuid,text) to authenticated, service_role;
grant execute on function public.technician_request_external(text,uuid,text) to authenticated, service_role;
grant execute on function public.technician_set_competencies(text,uuid,uuid[]) to authenticated, service_role;

create or replace function public.randcore_operations_snapshot(p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path='public','cron'
as $$
declare
  v_uid uuid:=auth.uid();
  v_hours integer:=greatest(1,least(coalesce(p_hours,24),168));
  v_since timestamptz:=now()-make_interval(hours=>greatest(1,least(coalesce(p_hours,24),168)));
  v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.hotel_memberships where auth_user_id=v_uid and active=true and can_access_admin=true) then
    raise exception 'admin_membership_required';
  end if;

  with jobs as (
    select coalesce(r.jobname,j.jobname) jobname,
      j.jobid,j.schedule,j.active,
      r.purpose,r.owner_module,r.kind,r.event_driven,r.pauseable,r.retryable,r.cost_class,r.expected_schedule,r.notes,
      case when r.jobname is null then true else false end unmanaged,
      (select jsonb_build_object('runid',d.runid,'status',d.status,'return_message',left(coalesce(d.return_message,''),500),'start_time',d.start_time,'end_time',d.end_time)
       from cron.job_run_details d where d.jobid=j.jobid order by d.start_time desc nulls last limit 1) last_run,
      (select count(*) from cron.job_run_details d where d.jobid=j.jobid and d.start_time>=v_since and lower(coalesce(d.status,'')) not in ('succeeded','success')) recent_failures
    from public.randcore_worker_registry r
    full outer join cron.job j on j.jobname=r.jobname
  )
  select jsonb_build_object(
    'generated_at',now(),'hours',v_hours,
    'cron_timezone',coalesce(current_setting('cron.timezone',true),'UTC'),
    'workers',coalesce(jsonb_agg(to_jsonb(jobs) order by jobname),'[]'::jsonb),
    'unmanaged_count',count(*) filter(where unmanaged),
    'event_driven_idle_count',count(*) filter(where event_driven and jobid is null)
  ) into v_result from jobs;
  return v_result;
end $$;
revoke all on function public.randcore_operations_snapshot(integer) from public, anon;
grant execute on function public.randcore_operations_snapshot(integer) to authenticated, service_role;

create or replace function public.randcore_set_worker_active(p_jobname text,p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path='public','cron'
as $$
declare v_uid uuid:=auth.uid(); v_jobid bigint; v_pauseable boolean;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.hotel_memberships where auth_user_id=v_uid and active=true and can_access_admin=true) then raise exception 'admin_membership_required'; end if;
  select pauseable into v_pauseable from public.randcore_worker_registry where jobname=p_jobname;
  if coalesce(v_pauseable,false)=false then raise exception 'worker_not_pauseable'; end if;
  select jobid into v_jobid from cron.job where jobname=p_jobname limit 1;
  if v_jobid is null then raise exception 'worker_not_scheduled'; end if;
  perform cron.alter_job(v_jobid,null,null,null,null,p_active);
  return jsonb_build_object('jobname',p_jobname,'active',p_active,'updated_at',now());
end $$;
revoke all on function public.randcore_set_worker_active(text,boolean) from public, anon;
grant execute on function public.randcore_set_worker_active(text,boolean) to authenticated, service_role;

create or replace function public.randcore_security_snapshot()
returns jsonb
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.hotel_memberships where auth_user_id=v_uid and active=true and can_access_admin=true) then raise exception 'admin_membership_required'; end if;
  with risky as (
    select p.proname,pg_get_function_identity_arguments(p.oid) args,
      has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
      case when p.prorettype='trigger'::regtype then 'TRIGGER'
           when p.proname in ('ensure_urgent_reminder_worker','run_urgent_reminder_tick','sync_reminder_worker_cron') then 'INTERNAL_WORKER'
           else 'RPC' end kind
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  )
  select jsonb_build_object(
    'generated_at',now(),
    'anon_security_definer_count',count(*) filter(where anon_execute),
    'internal_authenticated_exposure_count',count(*) filter(where authenticated_execute and kind in('TRIGGER','INTERNAL_WORKER')),
    'functions',coalesce(jsonb_agg(jsonb_build_object('name',proname,'args',args,'kind',kind,'anon_execute',anon_execute,'authenticated_execute',authenticated_execute) order by proname),'[]'::jsonb)
  ) into v_result from risky;
  return v_result;
end $$;
revoke all on function public.randcore_security_snapshot() from public, anon;
grant execute on function public.randcore_security_snapshot() to authenticated, service_role;

create or replace function public.randcore_observability_cost_snapshot(p_hotel_id text default null,p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare v_uid uuid:=auth.uid(); v_hours integer:=greatest(1,least(coalesce(p_hours,24),168)); v_since timestamptz:=now()-make_interval(hours=>greatest(1,least(coalesce(p_hours,24),168))); v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.hotel_memberships where auth_user_id=v_uid and active=true and can_access_admin=true and (p_hotel_id is null or hotel_id=p_hotel_id)) then raise exception 'admin_membership_required'; end if;
  with traces as (
    select *,coalesce(trace->>'hotel_id',trace#>>'{context,hotel_id}') trace_hotel,
      coalesce(trace->>'provider',trace#>>'{model,provider}') provider,
      coalesce(trace->>'model',trace#>>'{model,name}') model,
      case when coalesce(trace->>'cost_usd','') ~ '^[0-9]+([.][0-9]+)?$' then (trace->>'cost_usd')::numeric end cost_usd,
      case when coalesce(trace#>>'{usage,input_tokens}','') ~ '^[0-9]+$' then (trace#>>'{usage,input_tokens}')::bigint end input_tokens,
      case when coalesce(trace#>>'{usage,output_tokens}','') ~ '^[0-9]+$' then (trace#>>'{usage,output_tokens}')::bigint end output_tokens
    from public.randai_observability_traces where started_at>=v_since
  ), scoped as (select * from traces where p_hotel_id is null or trace_hotel=p_hotel_id), provider_rows as (
    select coalesce(provider,'UNKNOWN') provider,coalesce(model,'UNKNOWN') model,count(*) trace_count,count(cost_usd) measured_cost_count,sum(cost_usd) cost_usd,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens
    from scoped group by 1,2
  )
  select jsonb_build_object(
    'generated_at',now(),'hours',v_hours,'hotel_id',p_hotel_id,
    'trace_count',(select count(*) from scoped),
    'unscoped_trace_count',(select count(*) from traces where trace_hotel is null),
    'cost_measured_count',(select count(cost_usd) from scoped),
    'cost_usd',(select case when count(cost_usd)>0 then sum(cost_usd) else null end from scoped),
    'input_tokens',(select sum(input_tokens) from scoped),
    'output_tokens',(select sum(output_tokens) from scoped),
    'providers',(select coalesce(jsonb_agg(to_jsonb(provider_rows) order by provider,model),'[]'::jsonb) from provider_rows)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.randcore_observability_cost_snapshot(text,integer) from public, anon;
grant execute on function public.randcore_observability_cost_snapshot(text,integer) to authenticated, service_role;
