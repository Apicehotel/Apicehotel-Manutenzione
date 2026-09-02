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
  v_hotel_id text;
  v_role text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select hotel_id,role into v_hotel_id,v_role
  from public.hotel_memberships
  where auth_user_id=v_uid and active=true and can_access_admin=true
  order by hotel_id limit 1;

  if v_hotel_id is null then raise exception 'admin_membership_required'; end if;
  if p_jobname not in ('weather-alert-worker-2h-daytime','sync-sensori-temperatura-secure') then raise exception 'worker_retry_not_allowed'; end if;

  select command into v_command from cron.job where jobname=p_jobname and active=true;
  if v_command is null then raise exception 'worker_not_active'; end if;

  execute v_command into v_request_id;

  insert into public.randai_worker_runs(worker_key,hotel_id,trigger_type,status,completed_at,metadata)
  values (p_jobname,v_hotel_id,'manual_retry','success',now(),jsonb_build_object('request_id',v_request_id,'submitted_only',true));

  insert into public.operational_audit_log(operation_id,hotel_id,actor_user_id,actor_role,module,action,record_type,record_id,source,outcome,metadata)
  values (v_operation_id,v_hotel_id,v_uid,v_role,'randai_control','worker_retry','worker',p_jobname,'randai_control','submitted',jsonb_build_object('request_id',v_request_id));

  return jsonb_build_object('ok',true,'jobname',p_jobname,'request_id',v_request_id,'submitted_at',now());
end;
$$;

revoke all on function public.randai_retry_worker(text) from public,anon;
grant execute on function public.randai_retry_worker(text) to authenticated;
