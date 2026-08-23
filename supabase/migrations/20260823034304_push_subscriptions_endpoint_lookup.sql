create index if not exists idx_push_user_hotel
  on public.push_subscriptions (utente, hotel_id);
