create or replace function public.get_usage_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'utenti', (select count(*) from utenti),
    'segnalazioni', (select count(*) from segnalazioni),
    'interventi', (select count(*) from interventi),
    'richieste_urgenti', (select count(*) from richieste_urgenti),
    'push_subscriptions', (select count(*) from push_subscriptions),
    'whatsapp_inbox', (select count(*) from whatsapp_inbox)
  );
$$;

grant execute on function public.get_usage_stats() to anon, authenticated;
