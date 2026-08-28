-- Complete Punto 9: reliable health semantics, safe incident access, bounded diagnostics retention.

create index if not exists promemoria_invio_hotel_created_status_idx
  on public.promemoria_invio (hotel_id, created_at desc, status);
create index if not exists notification_outbox_hotel_created_status_idx
  on public.notification_outbox (hotel_id, created_at desc, status);

create or replace function public.get_operational_health(p_hotel_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_weather_checked timestamptz;
  v_weather_level text;
  v_sensor_total int := 0;
  v_sensor_stale int := 0;
  v_sensor_offline int := 0;
  v_urgent_failed int := 0;
  v_urgent_overdue int := 0;
  v_reminder_problem int := 0;
  v_outbox_problem int := 0;
  v_diag_errors int := 0;
  v_diag_fatal int := 0;
  v_push_count int := 0;
  v_cron_problem int := 0;
  v_status text := 'ok';
  v_expected_cron text[] := array[
    'reminder-worker-1m',
    'sync-sensori-temperatura-secure',
    'urgent-reminder-worker-30s',
    'weather-alert-worker-10m',
    'diagnostic-retention-daily'
  ];
begin
  if auth.uid() is null or not public.can_admin_hotel(p_hotel_id) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;

  select last_checked_at, level into v_weather_checked, v_weather_level
  from public.weather_alert_state where hotel_id = p_hotel_id;

  select count(*),
         count(*) filter (where aggiornato_il is null or aggiornato_il < now() - interval '45 minutes'),
         count(*) filter (where online is false)
    into v_sensor_total, v_sensor_stale, v_sensor_offline
  from public.sensori_temperatura s
  where case p_hotel_id
    when 'hotelgio' then s.mostra_hotelgio
    when 'gio' then s.mostra_hotelgio
    when 'chocohotel' then s.mostra_chocohotel
    when 'brigantino' then s.mostra_brigantino
    else false end;

  select count(*) filter (where status='failed' and coalesce(updated_at,created_at) > now()-interval '24 hours'),
         count(*) filter (where status in ('pending','processing') and scheduled_at < now()-interval '5 minutes')
    into v_urgent_failed, v_urgent_overdue
  from public.urgent_reminder_jobs where hotel_id=p_hotel_id;

  select count(*) into v_reminder_problem
  from public.promemoria_invio
  where hotel_id=p_hotel_id and created_at > now()-interval '24 hours' and status in ('blocked','partial','failed');

  select count(*) into v_outbox_problem
  from public.notification_outbox
  where hotel_id=p_hotel_id and created_at > now()-interval '24 hours'
    and (status in ('failed','error') or (status in ('pending','queued') and created_at < now()-interval '10 minutes'));

  select count(*) filter (where severity in ('error','fatal')),
         count(*) filter (where severity='fatal')
    into v_diag_errors, v_diag_fatal
  from public.diagnostic_events
  where hotel_id=p_hotel_id and created_at > now()-interval '24 hours';

  select count(*) into v_push_count from public.push_subscriptions where hotel_id=p_hotel_id;

  select cardinality(v_expected_cron) - count(*) filter (where active is true)
    into v_cron_problem
  from cron.job
  where jobname = any(v_expected_cron);
  v_cron_problem := greatest(coalesce(v_cron_problem, cardinality(v_expected_cron)), 0);

  if v_weather_checked is null
     or v_weather_checked < now()-interval '30 minutes'
     or v_cron_problem>0
     or v_urgent_overdue>0
     or v_outbox_problem>0 then
    v_status := 'problem';
  elsif v_urgent_failed>0 or v_reminder_problem>0 or v_sensor_stale>0 or v_sensor_offline>0 or v_diag_fatal>0 or v_diag_errors>0 then
    v_status := 'warning';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'status', v_status,
    'weather', jsonb_build_object(
      'status', case when v_weather_checked is null or v_weather_checked < now()-interval '30 minutes' then 'problem' else 'ok' end,
      'level', v_weather_level,
      'last_checked_at', v_weather_checked
    ),
    'sensors', jsonb_build_object('status', case when v_sensor_stale>0 or v_sensor_offline>0 then 'warning' else 'ok' end, 'total', v_sensor_total, 'stale', v_sensor_stale, 'offline', v_sensor_offline),
    'urgent_jobs', jsonb_build_object(
      'status', case when v_urgent_overdue>0 then 'problem' when v_urgent_failed>0 then 'warning' else 'ok' end,
      'failed_24h', v_urgent_failed,
      'overdue', v_urgent_overdue,
      'failed', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'error', case when last_error is null or btrim(last_error)='' then 'Errore worker non specificato' else 'Errore worker registrato · dettaglio protetto' end,
          'updated_at', coalesce(updated_at,created_at)
        ) order by coalesce(updated_at,created_at) desc)
        from (
          select id,last_error,updated_at,created_at
          from public.urgent_reminder_jobs
          where hotel_id=p_hotel_id and status='failed'
          order by coalesce(updated_at,created_at) desc
          limit 10
        ) x
      ), '[]'::jsonb)
    ),
    'reminders', jsonb_build_object('status', case when v_reminder_problem>0 then 'warning' else 'ok' end, 'problems_24h', v_reminder_problem),
    'notifications', jsonb_build_object('status', case when v_outbox_problem>0 then 'problem' else 'ok' end, 'problems_24h', v_outbox_problem),
    'diagnostics', jsonb_build_object('status', case when v_diag_fatal>0 or v_diag_errors>0 then 'warning' else 'ok' end, 'errors_24h', v_diag_errors, 'fatal_24h', v_diag_fatal),
    'push', jsonb_build_object('status', case when v_push_count>0 then 'ok' else 'warning' end, 'subscriptions', v_push_count),
    'cron', jsonb_build_object(
      'status', case when v_cron_problem>0 then 'problem' else 'ok' end,
      'inactive', v_cron_problem,
      'expected', cardinality(v_expected_cron),
      'jobs', coalesce((
        select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active) order by jobname)
        from cron.job where jobname = any(v_expected_cron)
      ), '[]'::jsonb)
    ),
    'integrations', coalesce((select jsonb_object_agg(key, enabled) from public.integration_settings), '{}'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_operational_health(text) from public, anon;
grant execute on function public.get_operational_health(text) to authenticated;

create or replace function public.get_diagnostic_incidents(p_hotel_id text, p_limit int default 20)
returns table(kind text, message text, route text, app_build text, severity text, occurrences bigint, first_seen timestamptz, last_seen timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_admin_hotel(p_hotel_id) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;

  return query
  select d.kind, d.message, d.route, d.app_build,
         case when bool_or(d.severity='fatal') then 'fatal' else max(d.severity) end,
         count(*) as occurrences, min(d.created_at), max(d.created_at)
  from public.diagnostic_events d
  where d.hotel_id=p_hotel_id
    and d.created_at > now()-interval '7 days'
  group by d.kind,d.message,d.route,d.app_build
  order by max(d.created_at) desc
  limit greatest(1, least(coalesce(p_limit,20),100));
end;
$$;
revoke all on function public.get_diagnostic_incidents(text,int) from public, anon;
grant execute on function public.get_diagnostic_incidents(text,int) to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'diagnostic-retention-daily';

select cron.schedule(
  'diagnostic-retention-daily',
  '17 3 * * *',
  $$delete from public.diagnostic_events where created_at < now() - interval '30 days'$$
);
