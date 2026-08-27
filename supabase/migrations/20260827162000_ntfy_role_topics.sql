with roles(role) as (
  values ('admin'),('Supremo'),('Direzione'),('Direttore Centro Congressi'),('Portiere Notturno'),('manutentore'),('Tecnico esterno'),('Governante'),('Capo Governante'),('Reception'),('Isola dei Golosi'),('Ristorante Wine/Jazz'),('Colazione Jazz')
), hotels(hotel_id) as (
  values ('hotelgio'),('chocohotel'),('brigantino')
), setting as (
  select config from public.integration_settings where key='ntfy_alerts'
), per_hotel as (
  select h.hotel_id,
    jsonb_object_agg(
      r.role,
      coalesce(
        (select config->'role_topics'->h.hotel_id->>r.role from setting),
        'randapp-rem-' || h.hotel_id || '-' || replace(replace(encode(gen_random_bytes(18),'base64'),'/','_'),'+','-')
      )
    ) as role_topics
  from hotels h cross join roles r
  group by h.hotel_id
), all_topics as (
  select jsonb_object_agg(hotel_id,role_topics) v from per_hotel
)
update public.integration_settings
set config=coalesce(config,'{}'::jsonb)||jsonb_build_object('role_topics',(select v from all_topics))
where key='ntfy_alerts';
