delete from public.push_subscriptions a
using public.push_subscriptions b
where a.id <> b.id
  and a.endpoint = b.endpoint
  and a.hotel_id = b.hotel_id
  and a.utente = b.utente
  and coalesce(a.creato_il,'epoch'::timestamptz) < coalesce(b.creato_il,'epoch'::timestamptz);
