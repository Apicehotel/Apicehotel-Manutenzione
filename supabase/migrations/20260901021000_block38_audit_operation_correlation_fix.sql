-- Block 38 audit correlation fix: restore must never inherit the previous delete operation id.
create or replace function public.capture_operational_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end;
  v_state jsonb := coalesce(v_new, v_old);
  v_hotel_id text := v_state->>'hotel_id';
  v_record_id text := v_state->>'id';
  v_actor uuid := auth.uid();
  v_role text;
  v_module text;
  v_action text;
  v_operation_id text;
begin
  v_module := case tg_table_name
    when 'segnalazioni' then 'issues'
    when 'interventi' then 'interventions'
    when 'planning_lavori' then 'planning_work'
    when 'planning_lavori_giorni' then 'planning_work'
    else tg_table_name
  end;

  if tg_op = 'UPDATE' then
    if (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then v_action := 'soft_delete';
    elsif (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null then v_action := 'restore';
    else v_action := 'update'; end if;
  elsif tg_op = 'INSERT' then v_action := 'create';
  elsif tg_op = 'DELETE' then v_action := 'hard_delete';
  else v_action := lower(tg_op);
  end if;

  v_operation_id := case v_action
    when 'restore' then nullif(v_new->>'restore_operation_id','')
    when 'soft_delete' then nullif(v_new->>'delete_operation_id','')
    else coalesce(
      nullif(v_new->>'mutation_id',''),
      nullif(v_old->>'mutation_id',''),
      nullif(v_new->>'restore_operation_id',''),
      nullif(v_new->>'delete_operation_id',''),
      nullif(v_old->>'restore_operation_id',''),
      nullif(v_old->>'delete_operation_id','')
    )
  end;

  v_operation_id := coalesce(v_operation_id, 'RND-AUD-' || replace(gen_random_uuid()::text, '-', ''));
  if v_operation_id !~ '^RND-(OP|AUD)-' then
    v_operation_id := 'RND-AUD-' || replace(gen_random_uuid()::text, '-', '');
  end if;

  select hm.role into v_role
  from public.hotel_memberships hm
  where hm.auth_user_id = v_actor and hm.hotel_id = v_hotel_id and hm.active
  limit 1;

  insert into public.operational_audit_log(
    operation_id, hotel_id, actor_user_id, actor_role, module, action,
    record_type, record_id, source, outcome, before_state, after_state, metadata
  ) values (
    v_operation_id, v_hotel_id, v_actor, v_role, v_module, v_action,
    tg_table_name, v_record_id, 'database', 'succeeded',
    public.audit_redact_operational_state(v_old),
    public.audit_redact_operational_state(v_new),
    jsonb_build_object('trigger_operation', tg_op)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.capture_operational_audit() from public, anon, authenticated;
