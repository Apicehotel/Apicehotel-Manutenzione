// Storico: questo file esportava un client che puntava al DB reale di Hotel
// Giò (housekeeping e sensori leggevano da lì). Ora l'app unificata è
// autonoma e usa il proprio DB "Apice MultiHotel": housekeeping/sensori
// leggono da lì come tutto il resto, separati per hotel_id.
// L'export mantiene il nome 'hotelGioClient' solo per compatibilità con gli
// import esistenti (housekeeping.jsx, temperature.jsx) — punta al client unico.
export { supabase as hotelGioClient } from './supabase.js'
