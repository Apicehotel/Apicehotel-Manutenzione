create or replace function public.get_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  storage_total bigint := 0;
  storage_files bigint := 0;
  photos_total bigint := 0;
  photos_files bigint := 0;
  active_connections bigint := 0;
  max_connections bigint := 0;
begin
  if auth.uid() is null or exists (
    select 1 from public.hotels h where not public.can_admin_hotel(h.id)
  ) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;

  select
    coalesce(sum(case when jsonb_typeof(metadata->'size')='number' then (metadata->>'size')::bigint else 0 end),0),
    count(*)
  into storage_total, storage_files
  from storage.objects;

  select
    coalesce(sum(case when jsonb_typeof(metadata->'size')='number' then (metadata->>'size')::bigint else 0 end),0),
    count(*)
  into photos_total, photos_files
  from storage.objects
  where bucket_id='maintenance-photos';

  select coalesce(sum(numbackends),0)::bigint into active_connections from pg_stat_database;
  select setting::bigint into max_connections from pg_settings where name='max_connections';

  return (
    select jsonb_build_object(
      'db_size_bytes', pg_database_size(current_database()),
      'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
      'db_connections', active_connections,
      'db_max_connections', max_connections,
      'storage_bytes', storage_total,
      'storage_files', storage_files,
      'maintenance_photos_bytes', photos_total,
      'maintenance_photos_files', photos_files,
      'utenti', (select count(*) from public.utenti),
      'segnalazioni', (select count(*) from public.segnalazioni),
      'interventi', (select count(*) from public.interventi),
      'planning_lavori', (select count(*) from public.planning_lavori),
      'richieste_urgenti', (select count(*) from public.richieste_urgenti),
      'push_subscriptions', (select count(*) from public.push_subscriptions),
      'activity_30d', (
        select jsonb_agg(jsonb_build_object(
          'date', d::date,
          'segnalazioni', (select count(*) from public.segnalazioni s where s.creato_il::date=d::date),
          'interventi', (select count(*) from public.interventi i where i.creato_il::date=d::date)
        ) order by d)
        from generate_series(current_date - 29, current_date, interval '1 day') d
      ),
      'per_hotel', (
        select coalesce(jsonb_object_agg(hotel_id, stats), '{}'::jsonb)
        from (
          select h.id as hotel_id, jsonb_build_object(
            'segnalazioni', (select count(*) from public.segnalazioni s where s.hotel_id=h.id),
            'interventi', (select count(*) from public.interventi i where i.hotel_id=h.id),
            'richieste_urgenti', (select count(*) from public.richieste_urgenti r where r.hotel_id=h.id)
          ) as stats
          from public.hotels h
        ) x
      )
    )
  );
end;
$function$;
