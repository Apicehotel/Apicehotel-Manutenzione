-- Connect the Bricantino Twilio WhatsApp sender to RandApp's multihotel router.
insert into public.whatsapp_channel_settings (
  hotel_id,
  inbound_number,
  receive_enabled,
  ingestion_enabled,
  updated_at
)
values ('brigantino', '+390759970628', true, false, now())
on conflict (hotel_id) do update set
  inbound_number = excluded.inbound_number,
  receive_enabled = excluded.receive_enabled,
  updated_at = now();
