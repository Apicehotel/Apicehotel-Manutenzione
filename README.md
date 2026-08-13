# Apicehotel Manutenzione

Base React/Vite per la gestione manutenzioni di Hotel Giò, ChocoHotel e Hotel Il Brigantino. È un progetto parallelo: non usa né modifica i dati operativi di Hotel Giò.

## Prima fase

- flusso Home → struttura → login PIN → area operativa;
- sessione locale persistente fino a logout/cambio struttura;
- skeleton Segnalazioni con filtri, ordinamenti e matrice accessi multi-hotel;
- modello Supabase con `hotel_id`, membership e RLS anti cross-hotel;
- foto predisposte su bucket privato `maintenance-photos` (nel DB solo `foto_path`);
- GitHub App bridge read-only sotto `/api/github`;
- Twilio/WhatsApp dichiarato in configurazione ma disattivato, senza webhook.

## Sviluppo

```bash
npm install
npm run dev
npm test
npm run build
```

PIN demo: `0000`. I profili demo sono locali e servono solo a validare il flusso UI.

## GitHub App bridge

Variabili server-only: `GITHUB_APP_ID`, `GITHUB_REPO`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_BRIDGE_SECRET`. Non usare mai il prefisso `VITE_`.

- `GET /api/github/health`: restituisce solo lo stato generico di configurazione.
- `GET /api/github/test`: richiede `Authorization: Bearer <GITHUB_BRIDGE_SECRET>` e verifica in sola lettura il repository fisso `Apicehotel/Apicehotel-Manutenzione`.

Il bridge non accetta URL, owner, repository o operazioni dal client: non può essere usato come proxy GitHub generico. Token e segreti non vengono restituiti né registrati.

## Supabase

La migrazione `supabase/migrations/0001_initial_schema.sql` è destinata esclusivamente a un nuovo progetto Supabase. Non applicarla al database operativo Hotel Giò. Le policy verificano membership attiva e `hotel_id`; le colonne usate da RLS e ordinamenti sono indicizzate.

Concept UI: `docs/design/multihotel-ui-concept.png`.
