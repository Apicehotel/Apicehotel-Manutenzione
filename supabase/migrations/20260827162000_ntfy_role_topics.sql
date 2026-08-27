with roles as (
  select distinct hotel_id, role from public.hotel_memberships where active
), per_hotel as (
  select hotel_id,
    jsonb_object_agg(
      role,
      'randapp-rem-' || replace(hotel_id,'_','-') || '-' || replace(replace(encode(gen_random_bytes(18),'base64'),'/','_'),'+','-')
    ) as role_topics
  from roles
  group by hotel_id
), all_topics as (
  select jsonb_object_agg(hotel_id, role_topics) as v from per_hotel
)
update public.integration_settings s
set config = coalesce(s.config,'{}'::jsonb) || jsonb_build_object('role_topics',(select v from all_topics))
where s.key='ntfy_alerts' and not (coalesce(s.config,'{}'::jsonb) ? 'role_topics');
