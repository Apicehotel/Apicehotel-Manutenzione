# Apicehotel Manutenzione

Base React/Vite per la gestione manutenzioni di Hotel Giò, ChocoHotel e Hotel Il Brigantino. È un progetto parallelo: non usa né modifica i dati operativi di Hotel Giò.

## Prima fase

- flusso Home → struttura → login PIN → area operativa;
- sessione locale persistente fino a logout/cambio struttura;
- skeleton Segnalazioni con filtri, ordinamenti e matrice accessi multi-hotel;
- modello Supabase con `hotel_id`, membership e RLS anti cross-hotel;
- foto predisposte su bucket privato `maintenance-photos` (nel DB solo `foto_path`);
- Twilio/WhatsApp dichiarato in configurazione ma disattivato, senza webhook.

## Sviluppo

```bash
npm install
npm run dev
npm test
npm run build
```

PIN demo: `0000`. I profili demo sono locali e servono solo a validare il flusso UI.

## Supabase

`supabase/migrations/` contiene le 53 migrazioni realmente applicate al progetto Supabase "Apice MultiHotel" (allineate il 2026-08-20; prima conteneva solo 3 file scritti a mano, non corrispondenti allo stato reale del database). Due file contengono valori REDATTI al posto delle credenziali reali (chiavi VAPID, credenziali eWeLink, hash del PIN admin): questo repo è pubblico, quei valori esistono solo nella tabella `public.edge_function_secrets` del database live, mai in git.

Le policy RLS verificano membership attiva e `hotel_id`; le colonne usate da RLS e ordinamenti sono indicizzate.

Concept UI: `docs/design/multihotel-ui-concept.png`.
