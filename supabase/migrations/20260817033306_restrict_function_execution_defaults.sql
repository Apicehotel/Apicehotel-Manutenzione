-- Remove implicit EXECUTE inherited through PUBLIC.
revoke execute on function public.carica_camere_giorno(text, jsonb) from public;
revoke execute on function public.carica_camere_giorno(text, text, jsonb) from public;
revoke execute on function public.get_usage_stats() from public;
revoke execute on function public.pulisci_richieste_urgenti_vecchie() from public;
revoke execute on function public.issue_attachment_same_hotel(uuid, text) from public;
revoke execute on function public.is_hotel_member(text) from public;
revoke execute on function public.has_hotel_role(text, text[]) from public;
revoke execute on function public.can_admin_hotel(text) from public;

-- Explicit grants only where needed by signed-in application users/RLS.
grant execute on function public.carica_camere_giorno(text, jsonb) to authenticated;
grant execute on function public.carica_camere_giorno(text, text, jsonb) to authenticated;
grant execute on function public.get_usage_stats() to authenticated;
grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_hotel_role(text, text[]) to authenticated;
grant execute on function public.can_admin_hotel(text) to authenticated;
grant execute on function public.issue_attachment_same_hotel(uuid, text) to authenticated;

-- Cleanup is server/maintenance only.
grant execute on function public.pulisci_richieste_urgenti_vecchie() to service_role;
