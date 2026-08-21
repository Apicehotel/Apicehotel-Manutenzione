alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_key unique (endpoint);
