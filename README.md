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
- RandAI integrata nel flusso operativo fino al **Blocco 32**;
- Reliability & Safety condivisa RandApp/RandAI fino al **Blocco 37**.

### RandAI — blocchi operativi consolidati

- **27 — Operational Context Layer:** contesto automatico di hotel, utente, segnalazione, camera/area, apparecchiature, allegati, storico e procedure;
- **28 — Action Gateway:** ogni modifica operativa proposta da RandAI passa da permessi, rischio, eventuale conferma, esecuzione, verifica e audit;
- **29 — Persistent Task / Supervisor:** task RandAI persistenti, riprendibili e collegati alla singola segnalazione;
- **30 — RandAI nelle Segnalazioni:** Analizza, Guidami, Procedura, Casi simili e conclusione tramite Gateway;
- **31 — Operational Learning:** memoria riutilizzabile solo da interventi realmente verificati, con evidenza e promozione a procedura solo come bozza da approvare;
- **32 — Operational Prioritization & Dispatch:** ranking spiegabile delle segnalazioni, distinzione priorità/azionabilità, blocker e prossimo lavoro consigliato senza auto-assegnazioni fuori dal Gateway.

### Reliability — Blocco 33

Il **Reliability Foundation** introduce un envelope operativo comune e versionato per correlare azioni RandApp/RandAI senza duplicare task ID, checkpoint o idempotency già presenti nei runtime esistenti.

Contratto consolidato:

- `operationId` nello spazio `RND-OP-*` identifica stabilmente l'operazione;
- `correlationId` e `traceId` permettono correlazione con diagnostica e telemetria quando disponibili;
- ogni envelope porta `hotelId`, attore, ruolo, modulo, azione, record, sorgente e timestamp;
- l'envelope è validato e immutabile dopo la creazione;
- il contesto destinato ai log esclude volutamente PIN, token, email e altri dati personali non necessari;
- i task RandAI collegati a una segnalazione ricevono lo stesso `operationId`, propagato anche al Supervisor e al riepilogo operativo;
- `test/reliability-operation-envelope.test.js` rende permanente il contratto di validazione, immutabilità, correlazione e integrazione con i task segnalazione.

### Reliability — Blocco 34 Context & Scope Guard

Il **Context & Scope Guard** aggiunge un preflight applicativo deterministico prima delle operazioni sensibili. Non sostituisce Supabase/RLS o l'Action Gateway: intercetta prima della rete contesti incompleti o incoerenti e lascia al backend l'autorizzazione definitiva.

Contratto consolidato:

- policy **deny by default** quando mancano hotel/modulo o il contesto operativo richiesto;
- confronto hotel tra operazione, context corrente e record caricato;
- confronto attore, modulo/schermata, tipo record e `recordId` quando richiesti;
- supporto a risultato permessi esplicito e regole ownership con bypass privilegiato esplicito;
- errori stabili `MISSING_CONTEXT`, `HOTEL_MISMATCH`, `ACTOR_MISMATCH`, `RESOURCE_MISMATCH`, `PERMISSION_DENIED`, `OWNERSHIP_MISMATCH`, `MODULE_MISMATCH`;
- `prepareRandAIAction` richiede context coerente con hotel, modulo Segnalazioni e issue corrente prima di chiamare l'Edge Function;
- membership, ruolo/permesso, filtro `hotel_id`, transizione e optimistic concurrency restano verificati server-side;
- `test/reliability-context-scope-guard.test.js` copre allow, contesto mancante, cross-hotel, resource errata, actor mismatch, permission denied e ownership;
- dettagli architetturali in `docs/architecture/RELIABILITY_SAFETY.md`.

Il benchmark ha confermato di **non** introdurre ora un secondo policy engine esterno (OPA/Casbin): l'attuale combinazione Guard applicativo + permessi centralizzati + Action Gateway + Supabase/RLS è più semplice da mantenere e riduce il rischio di divergenza tra policy duplicate.

### Reliability — Blocco 35 Unified Validation & State Transition Layer

Il **Unified Validation Layer** introduce primitive e contratti di dominio condivisi prima delle scritture. Il suo compito è distinto dal Blocco 34: il Context/Scope Guard verifica chi/dove/su quale record; il Blocco 35 verifica se il payload e, quando lo stato corrente è realmente disponibile, la transizione richiesta sono validi.

Contratto consolidato:

- `src/reliability/validation-engine.js` fornisce `required`, allowlist, numeri finiti/intervalli, date/intervalli cronologici, transizioni e `assertValid`;
- gli errori applicativi hanno codice stabile `OPERATION_VALIDATION_FAILED` e una lista strutturata di issue `path/code/message/meta`;
- `src/reliability/domain-validation.js` definisce contratti per segnalazioni, urgenti, planning lavori, planning sale e magazzino;
- il primo wiring diretto nei data layer protegge `planning-work-data.js` e `inventory-data.js`, incluse date/stati, quantità non negative e movimenti stock non nulli;
- le regole specialistiche già presenti, come `validateIssueTransition` nell'Action Gateway RandAI, restano **KEEP** e non vengono sostituite da una state machine generica;
- non vengono introdotti limiti arbitrari non dichiarati dallo schema o dal dominio;
- Zod è **DEFER**: verrà rivalutato se i contratti verranno migrati a TypeScript; XState è **NO ADD** perché sproporzionato rispetto alle transizioni operative attuali;
- Supabase/RLS/RPC restano autorità server-side: la validazione client è preflight e non una barriera di sicurezza;
- `test/reliability-unified-validation.test.js` copre error contract, allowlist, transizioni, date, pax, magazzino e wiring dei data layer;
- dettagli e matrice KEEP/UPGRADE/ADD/DEFER in `docs/architecture/VALIDATION_LAYER.md`.

### Reliability — Blocco 36 Safe Write Engine

Il **Safe Write Engine** introduce un contratto comune per le scritture operative critiche: `preflight → idempotenza/precondizione → write → read-back → verifica`. Una risposta di trasporto positiva non basta più a considerare conclusa l'operazione.

Contratto consolidato:

- `src/reliability/safe-write-engine.js` coordina le fasi senza diventare un secondo workflow engine e senza dipendenze nuove;
- errori stabili: `SAFE_WRITE_INVALID_CONTRACT`, `SAFE_WRITE_NOT_CONFIRMED`, `SAFE_WRITE_VERIFY_FAILED`, `SAFE_WRITE_CONFLICT`;
- nessun retry nascosto: il retry resta al chiamante/outbox solo per operazioni dimostrate idempotenti;
- l'outbox IndexedDB esistente e le RPC atomiche di Magazzino/Urgenti restano **KEEP**;
- la create Planning Lavori non esegue più parent e giorni come write client separate: `create_planning_work_safe(...)` li crea nella stessa transazione PostgreSQL;
- `planning_lavori.mutation_id` rende la create idempotente e rifiuta il riuso della stessa chiave con payload differente;
- la RPC è `SECURITY INVOKER`: RLS e permessi del chiamante restano autoritativi;
- ogni giorno Planning riceve `hotel_id` dal server e `created_by_user_id` deriva dalla sessione autenticata;
- `planning_lavori_giorni.updated_at` è il version token per compare-and-swap; viene mantenuto come timestamp PostgreSQL originale senza perdita di precisione;
- update e delete Planning filtrano per `id + hotel_id + updated_at` quando la versione è disponibile, poi verificano il risultato con read-back;
- la create rilegge parent e giorni e verifica hotel, descrizione, mutation id, date e relazione parent/child;
- Storage + database non vengono presentati come una falsa transazione unica: i flussi foto mantengono cleanup/compensazione;
- `test/reliability-safe-write-engine.test.js` protegge ordine delle fasi, assenza di retry impliciti, idempotenza, read-back, verifica, delete-by-absence e wiring Planning;
- dettagli e matrice KEEP/UPGRADE/REPLACE/ADD in `docs/architecture/SAFE_WRITE_ENGINE.md`.

Il Blocco 39 resta il punto dedicato alla convergenza globale offline/concurrency: il 36 non duplica né sostituisce prematuramente `offline-store.js`.

### Reliability — Blocco 37 Authorization & RLS Verification Matrix

Il **Blocco 37** verifica e irrigidisce l'autorizzazione esistente senza introdurre un secondo motore permessi. `src/permissions.js`, `role_permissions`, gli helper PostgreSQL e Supabase RLS restano **KEEP**; il frontend continua a essere solo preflight/UX e il database resta autorità finale.

Contratto consolidato:

- policy `PUBLIC` nello schema applicativo vengono ristrette esplicitamente a `authenticated`, mantenendo invariati `USING` e `WITH CHECK` esistenti;
- `anon` e `authenticated` non ricevono più `TRUNCATE`, `TRIGGER` o `REFERENCES` sulle tabelle `public`, privilegi non necessari al client RandApp;
- `public.assert_randapp_authorization_baseline()` verifica deny-by-default, RLS attiva sulle tabelle operative critiche, policy CRUD presenti e assenza dei grant client troppo ampi;
- la migrazione chiama l'assertion e fallisce chiusa se il baseline non è rispettato;
- l'assertion non è invocabile dai client: `PUBLIC` è revocato e l'esecuzione è concessa solo a `service_role`;
- la matrice critica copre Segnalazioni, maintenance issues, Interventi, Urgenti, Planning Lavori + giorni, Planning Sale, Magazzino, Housekeeping e Tecnici;
- ownership e regole specifiche restano nelle policy di dominio: non vengono sostituite da una policy generica più debole;
- OPA/Casbin restano **NO ADD**: aggiungerli ora duplicherebbe la sorgente di verità invece di migliorare RLS;
- `test/reliability-authorization-rls-matrix.test.js` rende permanente il contratto di hardening;
- dettagli e matrice in `docs/architecture/AUTHORIZATION_RLS_MATRIX.md`.

Un blocco architetturale non è considerato completato finché codice, test e README non risultano coerenti nello stesso PR.

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
- reliability condivisa: `src/reliability/`;
- client Supabase: `src/supabase.js`;
- session policy: `src/session-policy.js`;
- offline: `src/offline-store.js`;
- diagnostica: `src/diagnostics-client.js`, `src/diagnostic-taxonomy.js`, `src/error-boundary.jsx`;
- telemetria opzionale: `src/external-telemetry.js`;
- migrazioni: `supabase/migrations/`;
- Edge Functions: `supabase/functions/`;
- test: `test/` + `scripts/`.

Per i dettagli tecnici aggiornati vedere `FRONTEND_ARCHITECTURE.md`, `docs/architecture/RELIABILITY_SAFETY.md`, `docs/architecture/VALIDATION_LAYER.md`, `docs/architecture/SAFE_WRITE_ENGINE.md` e `docs/architecture/AUTHORIZATION_RLS_MATRIX.md`.

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
- ogni blocco o consolidamento architetturale importante deve aggiornare questo README nello stesso PR, così documentazione e codice restano allineati;
- un blocco Reliability/RandAI non è `DONE` finché codice, test e README non sono coerenti nello stesso PR e i gate richiesti non risultano verdi.
