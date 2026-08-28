# RandApp — Frontend Architecture

Questo documento descrive lo stato consolidato di RandApp dopo i punti 1–18 della roadmap. Il codice reale prevale sempre su documentazione storica.

## 1. Stack e avvio

RandApp è una PWA **React 19 + Vite 7 + Supabase**.

```bash
npm ci
npm run dev
npm run build
npm test
```

Entry principali:

- `index.html`
- `src/main.jsx`
- `src/randapp/App.jsx`
- `src/randapp/Shell.jsx`

`src/main.jsx` gestisce anche due route pubbliche speciali:

- `/tecnico/:token` → portale tecnico esterno;
- `/s/:id` → vista pubblica della segnalazione.

Le route pubbliche caricano `styles.css` dinamicamente; l'app autenticata usa il design system RandApp.

## 2. Dipendenze runtime realmente mantenute

- `react`, `react-dom` — UI;
- `@supabase/supabase-js` — Auth, database, realtime, Edge Functions e Storage;
- `@tanstack/react-query` — orchestrazione dati della Home operativa;
- `dexie` — IndexedDB/coda offline;
- `xlsx` — import/elaborazione Housekeeping;
- `@sentry/react` — telemetria errori opzionale;
- `@opentelemetry/api`, `@opentelemetry/sdk-trace-web`, `@opentelemetry/exporter-trace-otlp-http` — tracing opzionale.

Dipendenze eliminate nel cleanup finale perché non più usate: `lucide-react`, `react-grid-layout`, `zod`, `zustand`.

Le icone principali della shell sono SVG inline in `src/randapp/ui.jsx`.

## 3. Bootstrap globale

`src/main.jsx`:

1. inizializza dimensione UI e tema;
2. monta `AppErrorBoundary`;
3. sceglie app autenticata, portale tecnico o vista pubblica;
4. registra PWA;
5. avvia presence e ownership guard urgenze;
6. inizializza diagnostica interna;
7. inizializza Sentry/OpenTelemetry solo se configurati;
8. prova il recupero della push subscription dopo load/session change.

## 4. CSS e design system

Il design system base è in `src/randapp/shell.css`; il layer finale di coerenza è `src/randapp/ui-coherence.css` e viene importato per ultimo.

Esistono ancora fogli funzionali mirati per sezioni che hanno geometrie specifiche, tra cui Planning Sale, Housekeeping, form segnalazioni, offline feedback e navigazione mobile. Non vanno duplicati ulteriormente: nuove regole trasversali devono preferire token/componenti condivisi.

Requisiti globali:

- mobile-first;
- safe-area iOS;
- `100dvh` / viewport dinamico;
- touch target almeno 44×44;
- tema Sistema/Chiaro/Scuro;
- dimensione Piccolo/Normale/Grande;
- nessun overflow orizzontale nelle viewport supportate.

## 5. Shell e navigazione

`src/randapp/Shell.jsx` è l'unica fonte del chrome applicativo autenticato:

- header;
- bottom navigation;
- drawer mobile;
- sidebar desktop;
- cambio struttura;
- routing a stato interno.

Una schermata non deve costruire una navbar propria.

La navigazione viene filtrata per permesso ma **nascondere un pulsante non equivale ad autorizzare**: la sicurezza definitiva resta nelle policy/RPC Supabase.

## 6. Home operativa

`src/randapp/Home.jsx` non è più una dashboard widget trascinabile. È una coda di lavoro ordinata per priorità e ruolo.

Sorgenti principali, sempre scoped per `hotel.id`:

- segnalazioni;
- urgenze;
- interventi/pianificato;
- promemoria;
- meteo operativo.

Le modalità Focus/Completa cambiano densità, non l'isolamento dati.

## 7. Autenticazione e sessione

Il frontend non confronta PIN.

`src/auth-data.js` usa Edge Functions (`pin-auth`, `admin-gate`, `user-pin`) e installa la sessione restituita con `supabase.auth.setSession()`.

Il flusso PIN server-side:

- hash bcrypt;
- lockout sui tentativi falliti;
- identità Supabase interna;
- password Auth casuale/rotante;
- membership hotel verificata prima del rilascio sessione.

La sessione valida viene mantenuta durante brevi perdite rete; il logout passa da Supabase.

## 8. Multi-hotel

Hotel canonici applicativi:

- `hotelgio`
- `chocohotel`
- `brigantino`

Alcuni alias storici possono sopravvivere in integrazioni/sensori per compatibilità; non introdurne di nuovi.

Ogni record operativo deve mantenere `hotel_id`. L'isolamento è difeso da una combinazione di:

- membership;
- RLS;
- `has_app_permission`;
- vincoli/FK composite su relazioni critiche;
- test cross-hotel;
- coda offline che conserva l'hotel originale dell'operazione.

## 9. Permessi

La matrice centrale è nel database (`role_permissions` + helper autorizzativi). Il frontend usa `canUser`/helper equivalenti per visibilità e UX.

Le RPC privilegiate devono verificare esplicitamente:

- `auth.uid()`;
- hotel richiesto;
- membership attiva;
- permesso per modulo/azione;
- identificatore del record insieme a `hotel_id` quando applicabile.

## 10. Offline

`src/offline-store.js` usa Dexie e conserva `hotelId` sia nella cache sia nell'outbox.

Principi:

- niente perdita dati quando la rete cade;
- retry controllato;
- operazione associata per sempre all'hotel di origine;
- errori/operazioni bloccate visibili in diagnostica;
- nessun reset distruttivo automatico.

## 11. Housekeeping

Housekeeping supporta import `.xls`, storico giornaliero e consolidamento per hotel/data.

Il database protegge:

- idempotenza del medesimo import;
- preservazione stato lavoro nello stesso giorno;
- snapshot/versioni;
- separazione struttura;
- RLS e RPC autorizzate.

## 12. Notifiche

Tre livelli distinti:

- inbox RandApp;
- push web/PWA;
- ntfy parallelo per hotel/ruolo.

`ntfy` non è il database delle notifiche. Gli identificatori/routing restano separati per struttura.

## 13. Diagnostica e telemetria

File principali:

- `src/diagnostics-client.js`
- `src/diagnostic-taxonomy.js`
- `src/error-boundary.jsx`
- `src/external-telemetry.js`

Gli incidenti sono classificati e hanno riferimento `RAND-XXXX`. Token, PIN, cookie, authorization header e segreti devono essere redatti.

Sentry/OpenTelemetry sono opzionali e disabilitati se non configurati.

## 14. Database e sicurezza

Le tabelle di servizio sensibili sono deny-by-grant per `anon`/browser e senza policy client quando devono restare service-only.

Le migrazioni applicate non vanno mai riscritte. Ogni modifica schema/RLS/RPC richiede una nuova migrazione.

Le funzioni `SECURITY DEFINER` client-callable sono ammesse solo quando intenzionali e devono implementare i controlli di autorizzazione internamente.

## 15. PWA e piattaforme

Target obbligatori per ogni modifica UI/funzionale:

- iOS / Safari / PWA;
- Android / Chrome / PWA;
- Windows / Chromium/Edge-like.

`public/manifest.webmanifest`, service worker/PWA e icone costituiscono l'identità installabile.

## 16. Quality gates

Comandi:

```bash
npm run test:matrix
npm run test:critical
npm test
npm run build
npm run test:e2e
npm run test:device
```

La CI esegue inoltre audit dipendenze e budget bundle.

La Quality Matrix in `test/quality-matrix.json` identifica i rischi che non possono sparire silenziosamente. Il Critical Gate deve includere i contratti ad alto rischio.

## 17. Regole per nuove modifiche

1. Non aggiungere dipendenze senza un vantaggio concreto rispetto alle primitive esistenti.
2. Non introdurre un secondo sistema di navigazione, tema, permessi o offline queue.
3. Ogni query/record operativo multi-hotel deve avere contesto hotel esplicito.
4. Riutilizzare i componenti `src/randapp/ui.jsx` prima di creare markup ad hoc.
5. Conservare messaggi utente comprensibili e dettagli tecnici nella diagnostica.
6. Non mettere segreti nel bundle Vite o nel repository.
7. Non rimuovere indici sulla sola base dell'advisor `unused_index`; verificare traffico/query reali.
8. Prima di chiudere una modifica critica: Quality Matrix, Critical Gate, suite completa, build ed E2E devono essere verdi.

## 18. Residui storici intenzionali

- Il repository mantiene il nome storico `Apicehotel-Manutenzione`, mentre il package/app branding è `RandApp - Manutenzione`.
- Alcune migrazioni e alias storici restano per compatibilità e audit; non sono codice morto da cancellare retroattivamente.
- Il vecchio bridge GitHub/Emergent non è più parte del codice applicativo. Il progetto Vercel attivo collegato al repository è `apicehotel-manutenzionr`.
