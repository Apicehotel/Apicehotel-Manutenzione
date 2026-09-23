-- Ensure the ntfy_alerts integration row exists.
-- Existing production topics are never overwritten (insert only when absent).

with roles(role) as (
  values
    ('admin'),('Supremo'),('Direzione'),('Direttore Centro Congressi'),('Portiere Notturno'),
    ('manutentore'),('Tecnico esterno'),('Governante'),('Capo Governante'),('Reception'),
    ('Isola dei Golosi'),('Ristorante Wine/Jazz'),('Colazione Jazz'),('Responsabile')
), hotels(hotel_id) as (
  values ('hotelgio'),('chocohotel'),('brigantino')
), seed_topics as (
  select jsonb_object_agg(
    hotel_id,
    'randapp-urgent-' || hotel_id || '-' || replace(replace(encode(gen_random_bytes(16), 'base64'), '/', '_'), '+', '-')
  ) as topics
  from hotels
), seed_role_topics as (
  select jsonb_object_agg(hotel_id, role_topics) as role_topics
  from (
    select h.hotel_id,
      jsonb_object_agg(
        r.role,
        'randapp-rem-' || h.hotel_id || '-' || replace(replace(encode(gen_random_bytes(12), 'base64'), '/', '_'), '+', '-')
      ) as role_topics
    from hotels h
    cross join roles r
    group by h.hotel_id
  ) per_hotel
)
insert into public.integration_settings(key, enabled, config)
select
  'ntfy_alerts',
  true,
  jsonb_build_object(
    'server', 'https://ntfy.sh',
    'topics', (select topics from seed_topics),
    'role_topics', (select role_topics from seed_role_topics)
  )
where not exists (
  select 1 from public.integration_settings where key = 'ntfy_alerts'
);
