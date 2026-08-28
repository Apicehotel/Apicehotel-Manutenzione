# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Stato attuale

RandApp usa un unico progetto Supabase multi-hotel. I dati operativi sono separati tramite `hotel_id`, membership, RLS, vincoli relazionali e test cross-hotel. Il frontend usa sessioni Supabase ottenute tramite autenticazione PIN server-side; il PIN non viene confrontato nel browser.

Funzioni principali consolidate:

- segnalazioni manutentive con foto e ciclo di lavorazione;
- avvisi urgenti con presa in carico, completamento e reminder;
- interventi e planning lavori;
- planning sale;
- housekeeping con import `.xls`, storico giornaliero e idempotenza;
- promemoria e inbox notifiche;
- push + ntfy per struttura;
- meteo operativo;
- modalità offline con coda di sincronizzazione;
- diagnostica con codici incidente `RAND-XXXX`;
- ruoli e permessi centralizzati;
- PWA responsive per iOS, Android e Windows.

## Avvio locale

```bash
npm ci
npm run dev
```

Comandi di qualità:

```bash
npm run build
npm run test:matrix
npm run test:critical
npm test
npm run test:e2e
npm run test:device
```

`npm run test:quality` esegue matrice, gate critico e suite Node. La CI aggiunge build, budget bundle, Playwright cross-platform e device acceptance.

## Architettura

- entry: `src/main.jsx`;
- shell/UI: `src/randapp/`;
- client Supabase: `src/supabase.js`;
- offline: `src/offline-store.js`;
- diagnostica: `src/diagnostics-client.js`, `src/diagnostic-taxonomy.js`, `src/error-boundary.jsx`;
- telemetria opzionale: `src/external-telemetry.js`;
- migrazioni: `supabase/migrations/`;
- Edge Functions: `supabase/functions/`;
- test: `test/` + `scripts/`.

Per i dettagli tecnici aggiornati vedere `FRONTEND_ARCHITECTURE.md`.

## Sicurezza

Le tabelle di servizio sensibili sono deny-by-grant per i ruoli browser. Le RPC privilegiate verificano sessione, hotel e permessi; le relazioni critiche includono il contesto hotel. Il bucket foto manutenzione è privato.

La chiave Supabase pubblicabile può comparire nel client; service role, segreti Edge Function, token e credenziali private non devono mai essere inseriti nel repository.

## Configurazione

`src/supabase.js` contiene il progetto Supabase di produzione con chiave pubblicabile e permette override tramite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sentry e OpenTelemetry sono opzionali e vengono inizializzati solo se esplicitamente configurati/abilitati.

## Deploy

Il progetto Vercel attivo è `apicehotel-manutenzionr`, collegato a questo repository. Non esiste più codice applicativo del vecchio GitHub/Emergent bridge nel repository.

## Regole di manutenzione

- nessuna funzione operativa deve perdere `hotel_id`;
- navigazione e autorizzazione sono separate: l'autorizzazione definitiva resta nel database;
- non modificare migrazioni già applicate: aggiungere una nuova migrazione;
- non rimuovere indici solo perché momentaneamente segnalati come `unused`;
- ogni modifica critica deve mantenere verdi Quality Matrix, Critical Gate e test multipiattaforma.
