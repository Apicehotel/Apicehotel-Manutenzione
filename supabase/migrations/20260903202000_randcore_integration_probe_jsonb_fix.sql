-- Block 73 production compatibility fix.
-- Keep the applied 201000 migration immutable; replace only the integration probe.
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
    select coalesce(s.enabled,false),
           coalesce((select count(*)::integer from jsonb_object_keys(coalesce(s.config->'topics','{}'::jsonb))),0)
      into v_ntfy_enabled, v_ntfy_topics
      from public.integration_settings s
      where s.key='ntfy_alerts';
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
