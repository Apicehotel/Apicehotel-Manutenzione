# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Stato attuale

RandApp usa un unico progetto Supabase multi-hotel. I dati operativi sono separati tramite `hotel_id`, membership, RLS, vincoli relazionali e test cross-hotel. L'autenticazione PIN è server-side: il PIN non viene confrontato nel browser.

Funzioni consolidate:

- segnalazioni manutentive con foto, storico, filtri, ordinamenti e workflow operativo;
- avvisi urgenti con presa in carico, completamento e reminder;
- interventi, Planning Lavori e Planning Sale;
- Housekeeping con import `.xls`, storico giornaliero e idempotenza;
- promemoria, inbox notifiche, push e ntfy per struttura;
- meteo operativo, sensori e impianti;
- magazzino multi-hotel con giacenze, soglie, movimenti, foto e operazioni atomiche;
- modalità offline con outbox IndexedDB, retry controllato e gestione conflitti;
- diagnostica con codici incidente `RAND-XXXX`;
- ruoli e permessi centralizzati;
- PWA responsive per iOS, Android e Windows;
- App Shell Foundation, UI Components & Theme System e RandAI Contextual Integration completati;
- RandAI operativo fino al Blocco 32;
- Reliability & Safety condivisa RandApp/RandAI fino al Blocco 39.

## Strategia piattaforme

- **iPhone/iPad:** PWA/Web App;
- **Android:** PWA/Web App oggi, architettura predisposta per un futuro APK Capacitor senza rifare la UI;
- **Windows:** PWA/Web App con layout desktop/sidebar.

La shell gestisce safe-area browser e inset nativi opzionali. Un futuro wrapper Android può alimentare `--rs-native-safe-*` tramite il bridge `randapp-system-insets`.

## UI — percorso consolidato in 3 punti

### Punto 1 — App Shell Foundation

Contratto definitivo della shell:

- bottom navigation mobile a cinque slot: `Segnalazioni · Interventi · Home · Planning · Menu`;
- Home sempre nello slot centrale 3;
- permessi e visibilità non alterano la geometria della navbar;
- il `+` è un'azione separata dalle destinazioni;
- safe-area effettiva = massimo tra browser `env(safe-area-inset-*)` e inset nativi opzionali;
- nessun cap artificiale all'inset inferiore;
- Android 3 tasti, gesture navigation e Home Indicator iOS possono riservare lo spazio reale necessario;
- da 960px in su Windows/desktop usa la sidebar;
- Piccolo/Normale/Grande condividono la stessa architettura e usano `--rs-scale`.

File principali:

- `src/randapp/shell-navigation.js`
- `src/randapp/system-insets.js`
- `src/randapp/app-shell-foundation.css`
- `docs/architecture/APP_SHELL_FOUNDATION.md`

### Punto 2 — UI Components & Theme System

Il design system è light-first e mantiene `Sistema`, `Chiaro`, `Scuro`.

Principi:

- superfici Material-inspired sui componenti `rs-*` esistenti;
- Liquid Glass limitato a chrome, Sheet e azioni dove migliora gerarchia e profondità;
- niente secondo framework UI runtime: Konsta, 21st e librerie glass sono riferimenti di pattern, non dipendenze duplicate;
- accento hotel separato dai colori semantici;
- errore/urgenza, warning e successo restano semanticamente indipendenti dal tema hotel;
- fallback senza `backdrop-filter`;
- supporto a `prefers-reduced-motion`, contrasto aumentato e forced colors.

File principali:

- `src/randapp/ui-material-glass.css`
- `src/randapp/theme.js`
- `src/randapp/theme-coherence.css`
- `docs/architecture/UI_COMPONENTS_THEME_SYSTEM.md`

### Punto 3 — RandAI Contextual Integration

RandAI è parte nativa della shell e non una chat separata che richiede di riscrivere informazioni già note a RandApp.

Contratto finale:

- `RandAIContextBridge` viene montato solo con sessione autenticata;
- il contesto globale minimo contiene struttura, utente della sessione e schermata operativa corrente;
- una feature può pubblicare un contesto più ricco; la risorsa attiva ha precedenza sul contesto generico;
- nelle Segnalazioni il contesto include issue ID, camera/zona, categoria, stato, urgenza, riepilogo, stato camera e presenza foto;
- `retrieveRandAIGuidance` usa `operationalContext` esplicito oppure il contesto corrente pubblicato;
- il `+` globale contiene `Chiedi a RandAI`;
- il Cyber Cat Orb nell'header e il `+` aprono lo stesso assistente e lo stesso runtime;
- nessuna scrittura operativa viene eseguita dalla chat libera: modifiche e chiusure passano sempre dall'Action Gateway;
- il contesto minimo esclude PIN, token, email e telefono;
- nessun secondo agent framework o secondo context store è stato aggiunto.

File principali:

- `src/randai/context/RandAIContextBridge.jsx`
- `src/randai/context/envelope.js`
- `src/randai/randai-data.js`
- `src/randapp/RandAISuggestion.jsx`
- `src/randapp/InsertLauncher.jsx`
- `docs/architecture/RANDAI_CONTEXTUAL_INTEGRATION.md`

## RandAI — blocchi operativi 27–32

- **27 — Operational Context Layer:** hotel, utente, segnalazione, camera/area, apparecchiature, allegati, storico e procedure;
- **28 — Action Gateway:** permessi, rischio, conferma, esecuzione, verifica e audit per ogni modifica operativa;
- **29 — Persistent Task / Supervisor:** task persistenti e riprendibili collegati alla singola segnalazione;
- **30 — RandAI nelle Segnalazioni:** Analizza, Guidami, Procedura, Casi simili e conclusione tramite Gateway;
- **31 — Operational Learning:** memoria riutilizzabile solo da interventi verificati; nuove procedure restano bozze da approvare;
- **32 — Operational Prioritization & Dispatch:** ranking spiegabile, priorità distinta da azionabilità, blocker e prossimo lavoro consigliato senza auto-assegnazioni fuori dal Gateway.

RandAI non deve inventare procedure operative mancanti, soglie tecniche non configurate o stati dispositivi non mappati.

## Reliability & Safety — blocchi 33–39

### 33 — Reliability Foundation

Envelope operativo comune con `operationId` `RND-OP-*`, `correlationId`, `traceId`, hotel, attore, modulo, azione, record, sorgente e timestamp. Il contesto destinato ai log minimizza i dati e non include segreti o dati personali non necessari.

### 34 — Context & Scope Guard

Preflight deny-by-default per hotel, attore, modulo, risorsa, ownership e permessi. Errori stabili includono `MISSING_CONTEXT`, `HOTEL_MISMATCH`, `ACTOR_MISMATCH`, `RESOURCE_MISMATCH`, `PERMISSION_DENIED`, `OWNERSHIP_MISMATCH`, `MODULE_MISMATCH`.

Il backend Supabase/RLS resta l'autorità definitiva.

### 35 — Unified Validation & State Transition Layer

Primitive comuni per required, allowlist, numeri/intervalli, date, transizioni e contratti di dominio. Le regole specialistiche esistenti restano la fonte corretta quando più precise di una state machine generica.

### 36 — Safe Write Engine

Contratto comune `preflight → idempotenza/precondizione → write → read-back → verifica` per scritture critiche. Nessun retry nascosto. Planning Lavori usa RPC atomiche e compare-and-swap quando applicabile.

### 37 — Authorization & RLS Verification Matrix

RLS e privilegi browser irrigiditi. Le tabelle operative critiche mantengono policy CRUD esplicite e i client non ricevono privilegi SQL superflui. OPA/Casbin non vengono aggiunti per evitare una seconda sorgente di verità dei permessi.

### 38 — Audit & Reversible Operations

Audit append-only trasversale con `operationId`, hotel, attore, modulo/azione, record, before/after e outcome. Segnalazioni, Interventi e Planning critici usano soft-delete/restore quando previsto dal dominio.

### 39 — Offline, Retry & Concurrency Hardening

Outbox Dexie/IndexedDB con `operationId`, lease cross-tab, jitter retry, transazioni locali atomiche e compare-and-swap server-side. Le Segnalazioni mantengono idempotenza tramite `mutation_id`; i conflitti di versione diventano `OFFLINE_CONFLICT` invece di sovrascrivere dati più recenti.

## Parità e isolamento multi-hotel

Hotel Giò, Chocohotel e Hotel Il Brigantino condividono la stessa shell e le stesse funzioni generali. Una funzione non può essere nascosta solo perché l'hotel non è Giò.

Regole:

- funzioni permission-driven, non hotel-hardcoded;
- dati separati tramite `hotel_id` e RLS;
- cache/outbox mantengono il contesto hotel immutabile;
- Planning Sale è disponibile a ogni struttura autorizzata e usa configurazioni sale proprie;
- Housekeeping ha cache distinta per hotel;
- ntfy dichiara configurazioni per le tre strutture;
- differenze reali di camere, sale, impianti, sensori, contatti e procedure restano specifiche della struttura.

Le regole camere di Hotel Giò sono specifiche di Giò e non vanno propagate alle altre strutture.

## Contratti operativi importanti

### Segnalazioni

Ricerca, stato e filtri avanzati sono combinabili. Ordinamenti disponibili: camera/zona, urgenza, stato, categoria e data. Le camere vengono ordinate numericamente.

Una Segnalazione aperta pubblica il proprio Operational Context a RandAI. Analisi, percorso guidato e Action Gateway condividono la stessa risorsa e lo stesso hotel.

### Magazzino

Ogni articolo appartiene a una sola struttura e può contenere nome, categoria, unità, posizione, SKU/codice, giacenza, soglia minima, note e foto. I movimenti registrano quantità prima/dopo e non permettono giacenze negative.

Il controllo file non forza la fotocamera: iOS, Android e Windows possono proporre Fotocamera, Libreria o File secondo le capacità del dispositivo.

### Header operativo e RandAI

Il selettore struttura resta compatto. RandAI è una vera azione della toolbar tramite Cyber Cat Orb. Il pannello si apre sotto l'intestazione su mobile e usa il contesto operativo già pubblicato.

### Presenza e UI size

`Sono in struttura` identifica una sola struttura fisica alla volta. I controlli devono funzionare in Piccolo, Normale e Grande e mantenere coerenza su iOS, Android e Windows.

## Architettura

- entry: `src/main.jsx`;
- shell/UI: `src/randapp/`;
- App Shell: `src/randapp/shell-navigation.js`, `src/randapp/system-insets.js`, `src/randapp/app-shell-foundation.css`;
- visual layer: `src/randapp/ui-material-glass.css`, `src/randapp/theme.js`, `src/randapp/theme-coherence.css`;
- Planning: `src/randapp/planning/`;
- RandAI: `src/randai/`;
- RandAI context: `src/randai/context/`;
- reliability: `src/reliability/`;
- Supabase client: `src/supabase.js`;
- session policy: `src/session-policy.js`;
- offline: `src/offline-store.js`;
- diagnostica: `src/diagnostics-client.js`, `src/diagnostic-taxonomy.js`, `src/error-boundary.jsx`;
- telemetria opzionale: `src/external-telemetry.js`;
- migrazioni: `supabase/migrations/`;
- Edge Functions: `supabase/functions/`;
- test: `test/` + `scripts/`.

Documenti principali:

- `FRONTEND_ARCHITECTURE.md`
- `docs/architecture/APP_SHELL_FOUNDATION.md`
- `docs/architecture/UI_COMPONENTS_THEME_SYSTEM.md`
- `docs/architecture/RANDAI_CONTEXTUAL_INTEGRATION.md`
- `docs/architecture/RELIABILITY_SAFETY.md`
- `docs/architecture/VALIDATION_LAYER.md`
- `docs/architecture/SAFE_WRITE_ENGINE.md`
- `docs/architecture/AUTHORIZATION_RLS_MATRIX.md`
- `docs/architecture/AUDIT_REVERSIBLE_OPERATIONS.md`
- `docs/architecture/OFFLINE_RETRY_CONCURRENCY.md`

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

`npm run test:quality` esegue matrice, gate critico e suite Node. La CI aggiunge build, budget bundle, Playwright Chromium/WebKit e device acceptance.

## Sicurezza

- nessuna funzione operativa deve perdere `hotel_id`;
- autorizzazione definitiva nel database, non nel frontend;
- le tabelle di servizio sensibili sono deny-by-grant per i ruoli browser;
- RPC privilegiate verificano sessione, hotel e permesso;
- il bucket foto manutenzione è privato;
- la chiave Supabase pubblicabile può stare nel client;
- service role, token, secret Edge Function, PIN e credenziali private non devono entrare nel repository;
- RandAI non esegue scritture bypassando l'Action Gateway;
- apprendimento e procedure distinguono evidenza verificata da suggerimenti/bozze.

## Configurazione

`src/supabase.js` contiene il progetto Supabase di produzione con chiave pubblicabile e consente override tramite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sentry e OpenTelemetry sono opzionali e vengono inizializzati solo se configurati e abilitati.

## Deploy

- **Vercel:** produzione ufficiale RandApp, collegata a `main`;
- **DigitalOcean:** test/staging;
- **Supabase:** backend, database, autenticazione e servizi RandAI.

Il progetto Vercel attivo è `apicehotel-manutenzionr`.

## Regole di manutenzione

- non modificare migrazioni già applicate: aggiungere una nuova migrazione;
- non rimuovere indici solo perché momentaneamente segnalati `unused`;
- navigazione e autorizzazione restano separate;
- estrarre componenti condivisi solo quando riducono duplicazione reale o separano una responsabilità autonoma;
- ogni modifica critica deve mantenere verdi Quality Matrix, Critical Gate e test multipiattaforma;
- ogni modifica funzionale o architetturale che cambia il contratto documentato deve aggiornare questo README nello stesso PR;
- un blocco RandAI/Reliability non è `DONE` finché codice, test e README non risultano coerenti e i gate richiesti non sono verdi.
