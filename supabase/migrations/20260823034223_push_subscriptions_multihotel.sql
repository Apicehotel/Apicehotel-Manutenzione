alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
drop index if exists public.push_subscriptions_endpoint_key;

create unique index if not exists push_subscriptions_hotel_user_endpoint_key
  on public.push_subscriptions (hotel_id, utente, endpoint);

create index if not exists idx_push_endpoint
  on public.push_subscriptions (endpoint);
