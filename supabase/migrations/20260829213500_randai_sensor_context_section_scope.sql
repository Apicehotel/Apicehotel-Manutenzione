create or replace function public.randai_sensor_context(p_hotel_id text, p_query text)
returns table(device_id text, semantic_label text, zone text, signal_type text, unit text, scope text, temperature numeric, humidity text, online boolean, alert boolean, updated_at timestamptz, stale boolean)
language sql
security definer
set search_path = public
stable
as $$
  with q as (
    select lower(coalesce(p_query,'')) txt
  ), scoped as (
    select
      q.txt,
      case
        when q.txt ~ '\mjazz\M' and q.txt !~ '\mwine\M' then 'jazz'
        when q.txt ~ '\mwine\M' and q.txt !~ '\mjazz\M' then 'wine'
        else null
      end as requested_section
    from q
  )
  select b.device_id,b.semantic_label,b.zone,b.signal_type,b.unit,b.scope,s.temperatura,s.umidita,s.online,s.in_allerta,s.aggiornato_il,
         (s.aggiornato_il < now() - interval '15 minutes') as stale
  from public.randai_sensor_bindings b
  join public.sensori_temperatura s on s.device_id=b.device_id
  cross join scoped q
  where b.hotel_id=p_hotel_id and b.active
    and (
      (q.requested_section='jazz' and b.zone ilike '%Jazz%')
      or (q.requested_section='wine' and b.zone ilike '%Wine%')
      or (
        q.requested_section is null
        and (
          q.txt like '%condizion%'
          or q.txt like '%clima%'
          or q.txt like '%fredd%'
          or q.txt like '%cald%'
          or q.txt like '%temperatur%'
        )
      )
    )
  order by b.zone,b.semantic_label;
$$;

revoke all on function public.randai_sensor_context(text,text) from public, anon, authenticated;
grant execute on function public.randai_sensor_context(text,text) to service_role;
