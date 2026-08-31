# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Stato attuale

RandApp usa un unico progetto Supabase multi-hotel. I dati operativi sono separati tramite `hotel_id`, membership, RLS, vincoli relazionali e test cross-hotel. Il frontend usa sessioni Supabase ottenute tramite autenticazione PIN server-side; il PIN non viene confrontato nel browser.

Funzioni principali consolidate:

- segnalazioni manutentive con foto, ciclo di lavorazione e filtri/ordinamenti avanzati;
- avvisi urgenti con presa in carico, completamento e reminder;
- interventi e planning lavori;
- planning sale;
- housekeeping con import `.xls`, storico giornaliero e idempotenza;
- promemoria e inbox notifiche;
- push + ntfy per struttura;
- meteo operativo;
- magazzino multi-hotel con giacenze, scorte minime, carico/scarico atomico, storico movimenti e foto di riferimento articolo;
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
- `src/randapp/login-reference.css`: layout e tema di login/Admin Gate;
- `src/randapp/admin-keyboard-fix.css`: guardia mobile dedicata all'Admin Gate; mantiene il layout compatto e scrollabile quando la tastiera riduce il viewport senza introdurre cambi di geometria legati al focus dei pulsanti;
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

## Sicurezza accesso e recupero PIN — Consolidamento 3

Il contratto di autenticazione è intenzionalmente distinto:

- PIN utente operativo: **4 cifre**;
- PIN amministratore: **6 cifre**, separato visivamente e funzionalmente dal login operativo;
- la directory pre-login espone soltanto `legacy_id`, nome, struttura e stato minimo necessario al login; **ruolo, reparto, telefono, presenza, auth user id e permessi admin non vengono più inviati prima dell'autenticazione**;
- anche le vecchie directory conservate offline vengono normalizzate al nuovo payload minimo prima di essere riutilizzate;
- email, telefono, ruolo, presenza e permessi operativi vengono restituiti solo dopo autenticazione PIN valida;
- una sessione già validata può continuare offline per un massimo di **24 ore dall'ultima validazione server**;
- al ritorno online la sessione viene rivalidata e una revoca utente/hotel comporta logout locale;
- le operazioni sensibili non vengono accodate offline: accesso amministratore, cambio/reset PIN, modifica profilo, salvataggio codice notifiche e Action Gateway RandAI richiedono connessione e verifica server, con errore stabile `ONLINE_REQUIRED`;
- il recupero PIN è self-service: il browser invia solo `user_id + hotel_id`, l'email viene risolta server-side e non viene mostrata nel login;
- per il recupero PIN viene considerata l'email salvata nel profilo anche quando `email_verified=false`; il flag di verifica non viene reinterpretato globalmente né usato come requisito del recovery;
- i link di recupero scadono dopo 15 minuti, sono monouso, memorizzati solo come hash e protetti da rate limit;
- gli account di sistema protetti non possono usare il recupero PIN utente;
- il nuovo PIN viene hashato con bcrypt e azzera lockout/tentativi falliti.

Il trasporto email del recupero usa `pin-recovery` e richiede un provider realmente configurato. Per il sender Resend servono i secret Edge Function `RESEND_API_KEY`, `PIN_RECOVERY_FROM_EMAIL` e facoltativamente `PIN_RECOVERY_APP_URL` (default produzione Vercel). L'integrazione deve risultare abilitata in `integration_settings` e la funzione continua a dichiararsi non disponibile se sender o secret mancano.

## Prestazioni e caricamento — Consolidamento 4

Il bootstrap frontend è organizzato per caricare immediatamente solo ciò che serve alla route corrente e alla prima interazione, senza rinunciare a PWA, sicurezza e recovery.

Contratto di caricamento:

- `src/main.jsx` non importa più staticamente RandApp, RandAI Assistant, portale tecnico, vista segnalazione pubblica o short-link ntfy: ogni route ha un proprio boundary `React.lazy`;
- RandAI Assistant viene richiesto soltanto quando esiste una sessione RandApp locale e segue gli eventi `apice-session-changed` per login/logout;
- **la registrazione PWA/Service Worker resta immediata nel bootstrap** sulle route RandApp compatibili, perché installabilità e disponibilità offline sono un contratto di avvio e non un servizio autenticato;
- diagnostica e telemetria restano differite dopo il caricamento pagina, con fallback compatibile quando `requestIdleCallback` non è disponibile;
- push repair, onboarding notifiche, presenza e ownership degli urgenti non entrano nel bootstrap anonimo: i moduli vengono importati solo dopo una sessione valida e una sola volta per runtime;
- il repair push viene rieseguito quando cambia la struttura della sessione, senza reinizializzare gli altri servizi;
- deployment recovery, dimensionamento UI e tema restano immediati perché proteggono avvio e coerenza visiva;
- `xlsx` resta separato dal percorso JavaScript iniziale e viene caricato soltanto dal flusso di import che lo richiede;
- i CSS globali del design system restano nell'entry per evitare flash di stile e variazioni di cascade tra iOS, Android e Windows: l'ottimizzazione del Punto 4 riguarda i confini JavaScript misurati, non spostamenti CSS ad alto rischio;
- `scripts/check-bundle.mjs` impone un budget CI di **400 KiB** sul percorso JavaScript statico iniziale;
- i test di `test/performance-loading-boundaries.test.js` impediscono regressioni dei confini lazy/deferred e proteggono esplicitamente la registrazione PWA immediata.

La build Point 4 prima del ripristino PWA misurava **311,5 KiB in 2 chunk statici**. Il valore finale viene accettato solo dalla CI del commit definitivo e deve restare sotto il budget di 400 KiB; non viene quindi presentato il valore intermedio come misura finale.

Le prestazioni vengono accettate solo insieme ai gate di build, bundle budget, suite completa, Chromium/WebKit e device acceptance su profili iOS, Android e Windows.

## Parità e isolamento multi-hotel — Consolidamento 5

Il contratto multi-hotel distingue **parità funzionale** da **configurazione specifica della struttura**. Hotel Giò, Chocohotel e Hotel Il Brigantino condividono la stessa shell applicativa e le stesse funzioni generali; una funzione non può essere nascosta solo perché l'hotel non è Giò.

Regole consolidate:

- Segnalazioni, Interventi, Planning lavori, Planning sale, Housekeeping, Urgenti, Promemoria, notifiche, sensori/impianti, rubrica tecnici e RandAI sono permission-driven e non dipendono da un hard-code del singolo hotel;
- Planning Sale è disponibile a tutte e tre le strutture quando il ruolo possiede `planning_sale`; sale, clienti, layout e prenotazioni restano separati tramite `hotel_id`;
- Choco e Brigantino possono partire con una configurazione sale vuota e popolarla dalla UI autorizzata: non vengono inventati nomi o sale inesistenti;
- Housekeeping usa cache IndexedDB distinta per hotel e query/realtime filtrati per `hotel_id`; le differenze di camere e sezioni restano nel catalogo specifico di ciascuna struttura;
- cache/offline e outbox mantengono il contesto hotel immutabile; i test relazionali precedenti continuano a vietare child row cross-hotel;
- il backend è verificato con RLS attiva sulle principali tabelle operative multi-hotel, inclusi planning, housekeeping, sale, urgenti, manutenzioni, push e domini RandAI;
- ntfy dichiara topic per tutte e tre le strutture; WhatsApp/Twilio può avere configurazioni diverse per hotel, ma ogni struttura deve essere dichiarata esplicitamente e nessun numero viene inventato quando non configurato;
- `test/consolidation-point5-multihotel-parity.test.js` rende permanente il contratto di parità frontend e richiama i gate già esistenti per isolamento relazionale, RandAI e offline.

Le eccezioni legittime devono rappresentare una caratteristica reale della struttura (camere, reparti, sale, sensori presenti, recapiti o procedure locali), non una scorciatoia nel codice. In particolare le regole di numerazione e organizzazione camere di Hotel Giò restano specifiche di Giò e non vengono propagate a Choco o Brigantino.

## Contratti operativi recenti

### Segnalazioni — filtri e ordinamento

La vista Segnalazioni combina ricerca, stato e filtri avanzati. È possibile ordinare per camera/zona, urgenza, stato, categoria e data in senso crescente o decrescente. Le camere vengono ordinate numericamente, non lessicograficamente. I filtri restano combinabili e non alterano l'isolamento per `hotel_id`.

### Magazzino

Il Magazzino è una funzione multi-hotel permission-driven: ogni articolo appartiene a una sola struttura e contiene nome, categoria, unità di misura, posizione, codice/SKU, giacenza, soglia minima, note e foto di riferimento facoltativa. Carichi e scarichi sono registrati come movimenti con quantità prima/dopo; la RPC di variazione scorta impedisce giacenze negative e rende l'operazione atomica.

La foto serve a riconoscere il materiale reale (scatola, etichetta o ricambio). È salvata nel bucket privato delle foto e mostrata tramite URL firmato. L'inserimento **non deve forzare la fotocamera**: il controllo file usa il selettore nativo del sistema, così iOS, Android e Windows possono offrire Libreria foto, Fotocamera/Scatta foto e File secondo le capacità del dispositivo. Le immagini sono limitate a 10 MB.

### Header operativo compatto e RandAI

Nelle viste operative il selettore struttura è compatto e dedicato al solo contesto hotel. RandAI è una vera azione della toolbar dell'header, nello stesso gruppo di presenza e notifiche: non usa più un FAB né un launcher riposizionato con `position: fixed`. La sua identità visiva nell'header è **Cyber Cat Orb**, resa come SVG vettoriale con anello cyan→viola, volto cyber minimale e circuito centrale, così resta nitida anche nei controlli compatti. Il pannello RandAI resta separato e si apre sotto l'intestazione su mobile. Il comportamento deve rimanere coerente nelle modalità **Piccolo / Normale / Grande** e su iOS, Android e Windows.

### Presenza personale e UI size

Lo stato “Sono in struttura” è personale e identifica una sola struttura fisica alla volta; non è un booleano indipendente per ogni hotel. Nell'header il controllo usa le sigle compatte `GIO`, `CHO`, `BRI`. Tutti i nuovi controlli visuali devono rispettare le tre modalità **Piccolo / Normale / Grande** e mantenere coerenza su iOS, Android e Windows.

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
- session policy: `src/session-policy.js`;
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
- **ogni modifica funzionale, aggiunta, rimozione o cambio di comportamento deve aggiornare il README nello stesso commit/PR quando cambia il contratto documentato**; se una funzione viene rimossa, va rimossa anche dalla documentazione, senza lasciare descrizioni obsolete;
- ogni blocco o consolidamento architetturale importante deve aggiornare questo README nello stesso PR, così documentazione e codice restano allineati.
