# Apicehotel Manutenzione

Piattaforma unica per la gestione delle manutenzioni di 3 hotel:

- HotelGio
- ChocoHotel
- Hotel Il Brigantino

## Principi architetturali

- Multi-hotel con `hotel_id`
- Supabase Auth + RLS
- WhatsApp separato per struttura
- Segreti solo server-side / Edge Functions
- PWA e supporto offline
- Nessun accesso pubblico indiscriminato alle tabelle

## Stato

Scaffold iniziale. Nessun collegamento a database di produzione.
