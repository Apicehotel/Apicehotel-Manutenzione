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
- PWA responsive per iOS, Android e Windows;
- RandAI integrata nel flusso operativo fino al **Blocco 32**.

### RandAI — blocchi operativi consolidati

- **27 — Operational Context Layer:** contesto automatico di hotel, utente, segnalazione, camera/area, apparecchiature, allegati, storico e procedure;
- **28 — Action Gateway:** ogni modifica operativa proposta da RandAI passa da permessi, rischio, eventuale conferma, esecuzione, verifica e audit;
- **29 — Persistent Task / Supervisor:** task RandAI persistenti, riprendibili e collegati alla singola segnalazione;
- **30 — RandAI nelle Segnalazioni:** Analizza, Guidami, Procedura, Casi simili e conclusione tramite Gateway;
- **31 — Operational Learning:** memoria riutilizzabile solo da interventi realmente verificati, con evidenza e promozione a procedura solo come bozza da approvare;
- **32 — Operational Prioritization & Dispatch:** ranking spiegabile delle segnalazioni, distinzione priorità/azionabilità, blocker e prossimo lavoro consigliato senza auto-assegnazioni fuori dal Gateway.

## UI e design system

Il design system RandApp è mobile-first e mantiene lo stesso contratto su iOS, Android e Windows, con tema chiaro/scuro, safe-area e modalità Piccolo/Normale/Grande.

Struttura CSS consolidata:

- `src/randapp/shell.css`: token, superfici e componenti base `rs-*`;
- `src/randapp/adaptive-layout.css`: responsive layout, safe-area, navigazione mobile, Home centrata e bilanciamento header in modalità Grande;
- `src/randapp/ui-coherence.css`: accessibilità, focus, touch target e coerenza dei controlli;
- `src/randapp/login-reference.css`: layout e tema di login/Admin Gate, incluso comportamento con tastiera mobile;
- `src/randapp/hotel-selector-reference.css`: layout e tema del selettore struttura;
- `src/randapp/theme-coherence.css`: sole regole tema trasversali non appartenenti a una singola feature;
- CSS specifici di feature rimangono separati quando hanno responsabilità reale (Planning, nuova segnalazione, housekeeping, notifiche, RandAI).

I vecchi layer autonomi `planning-sale-fix.css`, `mobile-bottom-anchor.css`, `home-center-nav.css`, `large-header-balance.css`, `auth-theme-fix.css` e `theme-audit-fix.css` sono stati rimossi/assorbiti nei moduli proprietari. Le regole legacy del vecchio Planning Sale non più raggiungibili non vengono mantenute.

## Struttura React consolidata

Il frontend evita componenti universali troppo astratti: le estrazioni vengono fatte solo quando esiste una responsabilità stabile e condivisa.

Nel dominio Planning:

- `src/randapp/planning/date-utils.js` contiene le utility data comuni a Planning Sale e Planning Lavori;
- `src/randapp/planning/PlanningDateNavigator.jsx` è il navigatore periodo condiviso;
- `src/randapp/planning/NewWorkSheet.jsx` possiede esclusivamente il flusso di creazione di un lavoro pianificato;
- `src/randapp/planning/WorkRow.jsx` possiede esclusivamente stato/azioni della singola riga lavoro;
- `PlanningWorkSimple.jsx` resta un orchestratore della settimana invece di contenere sheet, righe, utility e navigazione nello stesso file;
- `PlanningSaleSimple.jsx` riusa lo stesso contratto di navigazione senza perdere logica specifica delle sale.

Regola architetturale: estrarre componenti condivisi solo quando riducono duplicazione reale o separano una responsabilità autonoma; non creare wrapper generici senza un beneficio operativo/testabile.

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
- componenti Planning focalizzati: `src/randapp/planning/`;
- motore RandAI: `src/randai/`;
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

RandAI non deve effettuare scritture operative bypassando l'Action Gateway. L'apprendimento operativo deve distinguere evidenza verificata da soluzione riutilizzabile e non può auto-approvare procedure.

## Configurazione

`src/supabase.js` contiene il progetto Supabase di produzione con chiave pubblicabile e permette override tramite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sentry e OpenTelemetry sono opzionali e vengono inizializzati solo se esplicitamente configurati/abilitati.

## Deploy

- **Vercel = produzione ufficiale RandApp**, collegata a `main`;
- **DigitalOcean = ambiente test/staging**;
- **Supabase = backend, database, autenticazione e servizi RandAI**.

Il progetto Vercel attivo è `apicehotel-manutenzionr`. Non esiste più codice applicativo del vecchio GitHub/Emergent bridge nel repository.

## Regole di manutenzione

- nessuna funzione operativa deve perdere `hotel_id`;
- navigazione e autorizzazione sono separate: l'autorizzazione definitiva resta nel database;
- non modificare migrazioni già applicate: aggiungere una nuova migrazione;
- non rimuovere indici solo perché momentaneamente segnalati come `unused`;
- ogni modifica critica deve mantenere verdi Quality Matrix, Critical Gate e test multipiattaforma;
- ogni blocco o consolidamento architetturale importante deve aggiornare questo README nello stesso PR, così documentazione e codice restano allineati.
