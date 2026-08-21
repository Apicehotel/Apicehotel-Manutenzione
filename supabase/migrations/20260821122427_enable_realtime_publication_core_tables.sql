-- ATTENZIONE: fix di un bug reale e diffuso. La pubblicazione
-- 'supabase_realtime' non aveva NESSUNA tabella registrata (verificato:
-- pg_publication_tables restituiva zero righe), nonostante il codice
-- client si aspettasse aggiornamenti realtime su tutte queste tabelle
-- (subscribeIssues, subscribePlanned, subscribeUrgents, Housekeeping,
-- TemperatureSensors). Risultato: nessun aggiornamento in tempo reale
-- da nessuna parte dell'app, indipendentemente da quanto fosse corretto
-- il codice client — le sottoscrizioni postgres_changes non avevano
-- alcuna tabella pubblicata da ascoltare.
alter publication supabase_realtime add table public.segnalazioni;
alter publication supabase_realtime add table public.interventi;
alter publication supabase_realtime add table public.richieste_urgenti;
alter publication supabase_realtime add table public.camere_giorno;
alter publication supabase_realtime add table public.camere_lavoro;
alter publication supabase_realtime add table public.sensori_temperatura;
