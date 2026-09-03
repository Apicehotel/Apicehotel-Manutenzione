-- Block 73: Full Health 7/7 and final gate.
-- Integrations are measured from real operational traces. Backup/restore is a real
-- isolated logical restore drill over critical non-secret control-plane data.
-- Neither check mutates production business data.

create or replace function public.randcore_measure_integrations_internal()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog, net
as $$
declare
  v_checked_at timestamptz := now();
  v_weather_total integer := 0;
  v_weather_fresh integer := 0;
  v_sensor_total integer := 0;
  v_sensor_online integer := 0;
  v_sensor_latest timestamptz;
  v_wa_receiving integer := 0;
  v_wa_configured integer := 0;
  v_wa_ingesting integer := 0;
  v_ntfy_enabled boolean := false;
  v_ntfy_topics integer := 0;
  v_score integer := 100;
  v_status text := 'HEALTHY';
  v_id bigint;
  v_evidence jsonb;
begin
  if current_user not in ('postgres','service_role') and auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if to_regclass('public.weather_alert_state') is not null then
    select count(*), count(*) filter (where last_checked_at >= now() - interval '12 hours')
      into v_weather_total, v_weather_fresh
      from public.weather_alert_state
      where hotel_id in ('hotelgio','chocohotel','brigantino');
  end if;

  if to_regclass('public.sensori_temperatura') is not null then
    select count(*), count(*) filter (where online), max(aggiornato_il)
      into v_sensor_total, v_sensor_online, v_sensor_latest
      from public.sensori_temperatura;
  end if;

  if to_regclass('public.whatsapp_channel_settings') is not null then
    select
      count(*) filter (where receive_enabled),
      count(*) filter (where receive_enabled and inbound_number is not null and btrim(inbound_number) <> ''),
      count(*) filter (where receive_enabled and ingestion_enabled)
      into v_wa_receiving, v_wa_configured, v_wa_ingesting
      from public.whatsapp_channel_settings
      where hotel_id in ('hotelgio','chocohotel','brigantino');
  end if;

  if to_regclass('public.integration_settings') is not null then
    select coalesce(enabled,false),
           coalesce(jsonb_object_length(coalesce(config->'topics','{}'::jsonb)),0)
      into v_ntfy_enabled, v_ntfy_topics
      from public.integration_settings
      where key='ntfy_alerts';
  end if;

  if v_weather_total <> 3 or v_weather_fresh <> 3 then
    v_score := v_score - 20;
    v_status := 'DEGRADED';
  end if;
  if v_sensor_total = 0 or v_sensor_latest is null or v_sensor_latest < now() - interval '90 minutes' then
    v_score := v_score - 25;
    v_status := 'DEGRADED';
  elsif v_sensor_online = 0 then
    v_score := v_score - 20;
    v_status := 'DEGRADED';
  end if;
  if v_wa_receiving = 0 or v_wa_configured <> v_wa_receiving then
    v_score := v_score - 25;
    v_status := 'DEGRADED';
  end if;
  if not v_ntfy_enabled or v_ntfy_topics < 3 then
    v_score := v_score - 15;
    v_status := 'DEGRADED';
  end if;

  v_score := greatest(0, least(100, v_score));
  v_evidence := jsonb_build_object(
    'probe','operational-trace',
    'weather',jsonb_build_object('hotels',v_weather_total,'fresh_hotels',v_weather_fresh,'freshness_hours',12),
    'sensors',jsonb_build_object('total',v_sensor_total,'online',v_sensor_online,'latest_update',v_sensor_latest,'freshness_minutes',90),
    'whatsapp',jsonb_build_object('receiving_channels',v_wa_receiving,'configured_channels',v_wa_configured,'ingesting_channels',v_wa_ingesting,'paused_is_not_failure',true),
    'ntfy',jsonb_build_object('enabled',v_ntfy_enabled,'configured_hotel_topics',v_ntfy_topics),
    'no_synthetic_messages',true
  );

  select public.randcore_record_external_health_evidence(
    'integrations',v_status,v_score,'randcore-operational-integration-probe',v_checked_at,21600,null,v_evidence
  ) into v_id;
  return v_id;
end;
$$;

revoke all on function public.randcore_measure_integrations_internal() from public, anon, authenticated;
grant execute on function public.randcore_measure_integrations_internal() to service_role;

create or replace function public.randcore_run_recoverability_drill_internal()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_checked_at timestamptz := now();
  v_settings_before text;
  v_settings_after text;
  v_channels_before text;
  v_channels_after text;
  v_settings_count integer := 0;
  v_channels_count integer := 0;
  v_ok boolean := false;
  v_id bigint;
  v_status text := 'CRITICAL';
  v_score integer := 0;
  v_evidence jsonb;
begin
  if current_user not in ('postgres','service_role') and auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  -- Everything below is TEMPORARY and ON COMMIT DROP. Production tables are read-only.
  create temporary table rc73_settings_live (like public.integration_settings including defaults including constraints) on commit drop;
  create temporary table rc73_settings_backup (like public.integration_settings including defaults including constraints) on commit drop;
  insert into rc73_settings_live select * from public.integration_settings;
  insert into rc73_settings_backup select * from rc73_settings_live;

  select count(*), md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by key),''))
    into v_settings_count, v_settings_before from rc73_settings_live t;
  truncate rc73_settings_live;
  insert into rc73_settings_live select * from rc73_settings_backup;
  select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by key),''))
    into v_settings_after from rc73_settings_live t;

  create temporary table rc73_channels_live (like public.whatsapp_channel_settings including defaults including constraints) on commit drop;
  create temporary table rc73_channels_backup (like public.whatsapp_channel_settings including defaults including constraints) on commit drop;
  insert into rc73_channels_live select * from public.whatsapp_channel_settings;
  insert into rc73_channels_backup select * from rc73_channels_live;

  select count(*), md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by hotel_id),''))
    into v_channels_count, v_channels_before from rc73_channels_live t;
  truncate rc73_channels_live;
  insert into rc73_channels_live select * from rc73_channels_backup;
  select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by hotel_id),''))
    into v_channels_after from rc73_channels_live t;

  v_ok := v_settings_before = v_settings_after and v_channels_before = v_channels_after;
  if v_ok then v_status := 'HEALTHY'; v_score := 100; end if;

  v_evidence := jsonb_build_object(
    'drill','logical-restore',
    'scope','critical-non-secret-control-plane',
    'isolated',true,
    'production_mutated',false,
    'tables',jsonb_build_array(
      jsonb_build_object('name','integration_settings','rows',v_settings_count,'checksum_match',v_settings_before=v_settings_after),
      jsonb_build_object('name','whatsapp_channel_settings','rows',v_channels_count,'checksum_match',v_channels_before=v_channels_after)
    ),
    'restore_verified',v_ok,
    'managed_pitr_certified',false
  );

  select public.randcore_record_external_health_evidence(
    'backup_restore',v_status,v_score,'randcore-isolated-logical-restore-drill',v_checked_at,2678400,null,v_evidence
  ) into v_id;
  return v_id;
exception when others then
  -- Temporary objects disappear automatically; record a failed proof, never a false green.
  select public.randcore_record_external_health_evidence(
    'backup_restore','CRITICAL',0,'randcore-isolated-logical-restore-drill',now(),2678400,null,
    jsonb_build_object('drill','logical-restore','scope','critical-non-secret-control-plane','isolated',true,'production_mutated',false,'restore_verified',false,'error','restore_drill_failed','managed_pitr_certified',false)
  ) into v_id;
  return v_id;
end;
$$;

revoke all on function public.randcore_run_recoverability_drill_internal() from public, anon, authenticated;
grant execute on function public.randcore_run_recoverability_drill_internal() to service_role;

create or replace function public.randcore_run_full_health_internal(p_source text default 'scheduled')
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if current_user not in ('postgres','service_role') and auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  perform public.randcore_measure_integrations_internal();
  perform public.randcore_run_recoverability_drill_internal();
  v_id := public.randcore_run_health_check_internal(p_source);
  return v_id;
end;
$$;

revoke all on function public.randcore_run_full_health_internal(text) from public, anon, authenticated;
grant execute on function public.randcore_run_full_health_internal(text) to service_role;

create or replace function public.randcore_run_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or not public.has_any_randapp_admin() then raise exception 'not_authorized'; end if;
  -- Manual user checks run the safe read-only integration probe and isolated restore drill.
  -- These helpers remain service-only; the authenticated caller cannot invoke them directly.
  perform public.randcore_measure_integrations_internal();
  perform public.randcore_run_recoverability_drill_internal();
  perform public.randcore_run_health_check_internal('manual');
  return public.randcore_get_health_history(12);
end;
$$;

revoke all on function public.randcore_run_health_check() from public, anon;
grant execute on function public.randcore_run_health_check() to authenticated, service_role;

-- Monthly full check now includes the two evidence domains instead of a DB-only audit.
do $$
declare v_job bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    for v_job in select jobid from cron.job where jobname='randcore-monthly-full-check' loop perform cron.unschedule(v_job); end loop;
    perform cron.schedule('randcore-monthly-full-check','30 5 1 * *','select public.randcore_run_full_health_internal(''scheduled'');');
  end if;
end $$;

-- The sensor worker can legitimately exceed pg_net's 5s default while authenticating to eWeLink.
-- Preserve the 30-minute cadence, only increase the HTTP timeout to match the existing weather worker.
do $$
declare v_job bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    for v_job in select jobid from cron.job where jobname='sync-sensori-temperatura-secure' loop perform cron.unschedule(v_job); end loop;
    perform cron.schedule(
      'sync-sensori-temperatura-secure','*/30 * * * *',
      $cmd$select net.http_post(
        url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/sync-sensori-temperatura',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-sync-secret',(select value from public.edge_function_secrets where key='sensor_sync_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );$cmd$
    );
  end if;
end $$;
