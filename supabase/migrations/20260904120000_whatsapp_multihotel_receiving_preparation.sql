-- Prepare the three hotel channels without activating inbound reception.
-- Giò and Choco keep their known numbers; Brigantino remains unnumbered.
insert into public.whatsapp_channel_settings (
  hotel_id,
  inbound_number,
  receive_enabled,
  ingestion_enabled,
  updated_at
)
values
  ('hotelgio', '+390759978247', false, false, now()),
  ('chocohotel', '+390759970610', false, false, now()),
  ('brigantino', null, false, false, now())
on conflict (hotel_id) do update set
  inbound_number = excluded.inbound_number,
  receive_enabled = false,
  ingestion_enabled = false,
  updated_at = now();

