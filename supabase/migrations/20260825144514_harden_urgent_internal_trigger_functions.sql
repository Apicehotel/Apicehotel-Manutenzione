-- Keep urgent escalation trigger helpers internal to Postgres/service_role.
-- The app-facing take/complete RPCs remain available only to authenticated users
-- and still enforce auth.uid(), hotel membership and allowed roles internally.

revoke execute on function public.cancel_urgent_reminders() from public, anon, authenticated;
revoke execute on function public.dispatch_initial_urgent_ntfy() from public, anon, authenticated;
revoke execute on function public.enqueue_urgent_reminders() from public, anon, authenticated;
revoke execute on function public.log_urgent_event() from public, anon, authenticated;

grant execute on function public.cancel_urgent_reminders() to service_role;
grant execute on function public.dispatch_initial_urgent_ntfy() to service_role;
grant execute on function public.enqueue_urgent_reminders() to service_role;
grant execute on function public.log_urgent_event() to service_role;

revoke execute on function public.prendi_urgente(uuid, text, text) from public, anon;
revoke execute on function public.completa_urgente(uuid, text, text) from public, anon;

grant execute on function public.prendi_urgente(uuid, text, text) to authenticated, service_role;
grant execute on function public.completa_urgente(uuid, text, text) to authenticated, service_role;
