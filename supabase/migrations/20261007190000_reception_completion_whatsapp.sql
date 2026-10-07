-- Create/approve a WhatsApp template such as:
-- "Manutenzione completata - {{1}} - {{2}} - {{3}}. Nota: {{4}}. Completata da: {{5}}."
-- Then set its approved Twilio Content SID in integration_settings.config.completion_content_sid.
update public.integration_settings
set config = config || jsonb_build_object('completion_content_sid', coalesce(config->>'completion_content_sid', '')),
    updated_at = now()
where key = 'twilio_whatsapp';

create index if not exists notification_outbox_completion_lookup_idx
  on public.notification_outbox (channel, hotel_id, recipient, created_at desc)
  where channel = 'whatsapp';
