-- Topic ntfy Housekeeping separati dai topic delle urgenze.
-- Vengono generati al momento della migrazione e non contengono dati personali.
insert into public.integration_settings(key, enabled, config)
values (
  'ntfy_housekeeping',
  true,
  jsonb_build_object(
    'server', 'https://ntfy.sh',
    'topics', jsonb_build_object(
      'hotelgio', 'randapp-hk-' || encode(gen_random_bytes(16), 'hex'),
      'chocohotel', 'randapp-hk-' || encode(gen_random_bytes(16), 'hex'),
      'brigantino', 'randapp-hk-' || encode(gen_random_bytes(16), 'hex')
    )
  )
)
on conflict (key) do nothing;
