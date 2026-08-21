-- Stesso bug della migrazione precedente: carica_camere_giorno viene
-- chiamata direttamente dal client (src/housekeeping.jsx, upload del file
-- Slope) con la sessione dell'utente autenticato, non tramite una edge
-- function con service role. Senza questo grant, il caricamento camere
-- in Housekeeping avrebbe dato lo stesso "permission denied".
grant execute on function public.carica_camere_giorno(text, jsonb) to authenticated;
grant execute on function public.carica_camere_giorno(text, text, jsonb) to authenticated;
