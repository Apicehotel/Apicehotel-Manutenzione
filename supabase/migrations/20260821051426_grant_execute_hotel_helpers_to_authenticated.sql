-- ATTENZIONE: fix di un bug reale. La migrazione 20260817041108
-- (audit_hardening_final) aveva revocato l'esecuzione di queste funzioni
-- da anon E authenticated, senza mai ri-concederla ad authenticated.
-- Queste funzioni sono usate DENTRO le policy RLS di quasi tutte le
-- tabelle (segnalazioni, interventi, richieste_urgenti, camere_giorno,
-- planning_lavori, prenotazioni_sale, tecnici, push_subscriptions,
-- hotel_memberships, maintenance_issues, issue_attachments, issue_events,
-- utenti...): senza il permesso di esecuzione, ogni utente autenticato
-- riceveva "permission denied for function is_hotel_member" (o simili)
-- su qualunque inserimento/aggiornamento che valutasse quella policy.
-- Confermato in produzione: creazione di un avviso urgente bloccata da
-- questo esatto errore.
grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_hotel_role(text, text[]) to authenticated;
grant execute on function public.can_admin_hotel(text) to authenticated;
grant execute on function public.issue_attachment_same_hotel(uuid, text) to authenticated;
