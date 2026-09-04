# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target obbligatori: iOS/iPadOS, Android e Windows. `hotel_id`, membership, RLS/RPC, Safe Write e audit restano confini di sicurezza canonici.

### RandAI Control Center — responsive UI

La console RandAI usa un layout unico e responsive: sidebar leggibile su desktop e tablet, navigazione orizzontale a larghezza piena su smartphone, schede a colonna singola sui telefoni e nessun overflow orizzontale intenzionale. La home contiene accessi rapidi a Segnalazioni, Manutenzioni, RandGuide e Configurazione; la mappa Ecosistema apre i moduli disponibili. Il tema è configurabile direttamente dall’intestazione RandAI con `Sistema`, `Chiaro` e `Scuro`, usando la stessa preferenza persistente di RandApp. La configurazione amministrativa è un centro unico con schede Utenti, Permessi e menu, RandAI e RandGuide: non duplica più le funzioni tra pannello laterale e dashboard. Le regole dedicate sono in `src/randai/control/randai-responsive.css` e vengono caricate direttamente da `RandAIControlCenter.jsx`.

## Regole architetturali non negoziabili

- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun modello o frontend riceve `service_role`, PIN, refresh token o secret non necessari.
- RLS/RPC Supabase sono l'autorità finale; nascondere un bottone non è autorizzazione.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Niente secondi sistemi di navigazione, autorizzazione, offline queue, logging, scheduler, inventario, knowledge, memory, learning, orchestrazione o health stack per la stessa responsabilità.
- Una parte viene eliminata come zombie solo dopo verifica di utilizzo e dipendenze.
- Se esiste una soluzione nettamente migliore, più semplice e più sicura, sostituisce quella debole invece di accumulare patch.

## Stato roadmap consolidata

### Fondazione RandAI — 1–26 ✅
Core/Orchestrator, Tool Registry, Skill Engine, Directive Composer, Maintenance Knowledge, Procedure Assistant, Planner→Executor→Verifier, Durable Tasks, Scoped Memory, Authorized Context, Model Router, Knowledge Gaps, Smart Suggestions, Guided Procedures, Project Intelligence, Observability, Evaluation/Benchmark, Multi-Agent, Autonomy, Recovery, Software Engineering Agent, Learning, Discovery, Supervisor, Proactive AI e Control Center.

### Reliability / Production — 27–50 ✅
Operational Context, Scope Guard, Unified Validation, Safe Write/Action Gateway, Authorization & RLS Matrix, Audit/Reversibility, Offline/Retry/Concurrency, Import Safety, Verification Gate, Evidence Trust, Hybrid Memory/Knowledge Graph, Confidence/Risk, Plan Validator, Execution Policy, Recovery Budgets/Circuit Breakers, Failure Intelligence, Adversarial/Fault Injection, Production Gate, Canary/Rollback, Runtime Fuse, Drift Guard, SLO/Error Budget e Release Attestation.

### Blocco 13 — 51–54 ✅
Ecosystem Truth Map, RandCore Manifest, RandControl 360° e Configuration 360°.

### Blocco 14 — 55–58 ✅
Repo Radar 2.0, Deep Repository Intelligence, Safe Adoption/Replacement Gate e Repo Radar in RandControl.

### Blocco 15 — 59–62 ✅
Unified Health Snapshot, Monthly Full Ecosystem Check, Findings/History/Drift e RandControl Health Console.

### Blocco 16 — 63–66 ✅
Operations & Workers, Security Center, Observability & Cost Center e Repo/Module Health.

### Blocco 17 — 67 ✅
Rand Warehouse Integration. Il Magazzino resta bounded domain autonomo, collegato a Interventi e RandAI senza un secondo inventario.

### Blocco 18 — 68–70 ✅
Final Ecosystem/E2E Gate, Zombie & Duplication Purge e Rand Ecosystem LTS 1.0.

Perimetro LTS 1.0 originario: `randapp`, `randai`, `randcore`, `randcontrol`, `reporadar`, `warehouse`. A quella release `RandGuide`, `RandMind`, `RandBrain`, `RandUI` erano `PARTIAL`, `RandAudio` e `Viking` `PLANNED`. Le promozioni successive sono evidence-backed: dal Blocco 22 `RandGuide` è `LIVE`; dal Blocco 23 `RandMind` è `LIVE`; dal Blocco 24 `RandBrain` è `LIVE`; dal Blocco 25 `RandUI` è `LIVE`; dal Blocco 26 RandAudio è una capability operativa ma resta `PARTIAL`; dal Blocco 27 Viking è `EVALUATED`, con adozione dei soli pattern compatibili e senza runtime esterno.

### Blocco 19 — Health Evidence Contract — 71 ✅

I sette domini canonici sono `database`, `security`, `workers`, `deploy`, `backup_restore`, `integrations`, `dependencies`. Ogni dominio espone stato evidenza `VERIFIED / STALE / UNKNOWN`, stato salute, score, sorgente, timestamp, freshness e confidence.

`100/100` descrive la qualità dei domini verificati e non implica copertura totale. L'aggregate può essere `HEALTHY` soltanto con 7/7 prove fresche e verificate.

Sorgenti: `src/randai/core/health-evidence.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `supabase/migrations/20260903173000_randcore_health_evidence_contract.sql`, `test/randai-block19-health-evidence-71.test.js`.

### Blocco 20 — External Evidence Bridge — 72 ✅

`randcore_external_health_evidence` è il canale append-only e service-only per `deploy`, `backup_restore`, `integrations`, `dependencies`. Browser, `anon` e utenti autenticati non possono scriverlo. La CI produce evidenze commit-bound reali per `deploy` e `dependencies`; RandControl le compone con `database/security/workers` senza duplicare il contratto Health Evidence.

Sorgenti: `scripts/randcore-external-evidence.mjs`, `supabase/migrations/20260903180500_randcore_external_evidence_bridge.sql`, `test/randai-block20-external-evidence-72.test.js`.

### Blocco 21 — Full Autodiagnosis & Final Gate — 73 ✅

73 chiude la fase health con una regola unica: `FULL_HEALTHY` è possibile soltanto con **7/7 VERIFIED + FRESH + HEALTHY, score 100, confidence 100 e coerenza del commit di deploy/dipendenze**.

`integrations` non usa messaggi sintetici né ping aggressivi: `randcore_measure_integrations_internal()` misura tracce operative realmente già prodotte da meteo, sensori, WhatsApp e configurazione ntfy. Canali WhatsApp esplicitamente in pausa non sono considerati guasti. Assenza, stale o configurazione incompleta degradano il dominio.

`backup_restore` non diventa verde perché “esiste un backup”. `randcore_run_recoverability_drill_internal()` esegue un **restore drill logico reale e isolato** su dati critici non-secret del control plane: copia in tabelle TEMP, crea una copia di backup TEMP, svuota esclusivamente la copia TEMP, la ripristina e confronta conteggi/checksum. Le tabelle di produzione sono solo lette. L'evidenza dichiara esplicitamente `isolated=true`, `production_mutated=false`, `restore_verified` e `managed_pitr_certified=false`: il gate certifica la recoverability applicativa verificata, non inventa una certificazione del PITR gestito dal provider.

`randcore_run_health_check()` esegue runtime audit + integration probe + restore drill. Il `randcore-monthly-full-check` usa lo stesso percorso completo. La UI RandControl mostra il Final Health Gate e le ragioni precise quando è `BLOCKED`.

Durante l'analisi reale del 73 sono emerse due debolezze operative, corrette invece di nasconderle: il worker meteo falliva ripetutamente sul primo hotel mentre gli altri due proseguivano, quindi il fetch Open-Meteo ora usa retry bounded e rende esplicito il partial failure; il worker sensori superava talvolta il timeout pg_net predefinito di 5 secondi durante l'autenticazione eWeLink, quindi mantiene la cadenza ogni 30 minuti ma usa timeout HTTP 20 secondi.

Zombie scan 73: nessun secondo health stack, scheduler, dashboard, backup engine, framework o dipendenza runtime. Il final gate compone 71+72 e usa le tracce operative già esistenti.

Sorgenti: `src/randai/core/full-health-gate.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `supabase/migrations/20260903201000_randcore_full_health_final_gate.sql`, `supabase/functions/weather-alert-worker/index.ts`, `test/randai-block21-full-health-73.test.js`, `.github/workflows/ci.yml`.

### Blocco 22 — RandGuide LIVE — 74–80 ✅

RandGuide consolida il knowledge/guidance domain già esistente invece di crearne uno parallelo. Le autorità restano `randai_procedures`, `randai_documents`, `randai_equipment`, `randai_guidance_sessions` e la Knowledge Console esistente.

Il blocco introduce catalogo e classificazione canonici, rischio e confidence, ingestione con provenance/deduplica, knowledge graph operativo hotel-scoped, authoring assistito che **non può auto-pubblicare**, version snapshot e pubblicazione governata via RPC. Le procedure `critical` richiedono caution; fonti con confidence insufficiente non possono essere pubblicate. RLS e membership mantengono l'isolamento multi-hotel.

`RandGuide` è promosso da `PARTIAL` a `LIVE` solo con evidenze reali nel manifest. I contratti storici sono stati aggiornati senza indebolire il fail-closed: un modulo `LIVE` senza evidence continua a essere rifiutato e RandGuide non può comparire contemporaneamente tra i deferred.

Migration production: `supabase/migrations/20260903213000_randguide_live_74_80.sql`. Tabelle aggiunte: `randguide_procedure_versions`, `randguide_links`; RLS attiva. `anon` non può eseguire `randguide_publish_procedure` né `randguide_get_graph`; `authenticated` può usare le RPC ma l'autorità server verifica membership/gestione hotel.

Zombie scan 74–80: nessun secondo knowledge system, navigation stack, auth plane, scheduler, framework o runtime dependency. `GuidedProcedureEngine` e Knowledge Console sono mantenuti perché canonici e in uso.

Sorgenti: `src/randai/guidance/catalog.js`, `src/randai/guidance/ingestion.js`, `src/randai/guidance/graph.js`, `src/randai/guidance/authoring.js`, `src/randai/guidance/production-gate.js`, `src/randai/core/ecosystem.js`, `test/randai-block22-randguide-74-80.test.js`.

### Blocco 23 — RandMind LIVE — 81–86 ✅

RandMind consolida il memory domain già esistente: `MemoryEngine`, `MemoryStore/SupabaseMemoryStore` e `randai_memory_items` restano le autorità canoniche. Non è stato aggiunto un secondo database, vector store o framework di memoria.

La facade `RandMind` aggiunge deduplica governata, memoria episodica e timeline temporale, quality scoring fail-closed, rilevamento conflitti, supersession nello stesso scope, retention class (`transient`, `operational`, `long_term`, `legal_hold`) e lifecycle (`active`, `superseded`, `forgotten`). Una memoria `outdated`, scaduta, dimenticata o superseded non viene richiamata come verità corrente.

La dimenticanza è un soft-delete auditabile tramite `randmind_forget_memory`: richiede motivo, verifica l'autorità hotel, marca la memoria `forgotten/outdated` e conserva la traccia. `legal_hold` blocca la dimenticanza. La supersession è rifiutata se tenta di attraversare hotel/project/task scope.

RandControl espone `RandMindConsole` nella sezione Ecosistema con conteggi active/verified/stale/forgotten, conflitti, provenienza, confidence, validità e retention. Il production gate rifiuta transient senza expiry, forget senza audit, self-supersession e trust verificato senza evidenza usabile.

Migration: `supabase/migrations/20260903223000_randmind_live_81_86.sql`. Zombie scan 81–86: nessun secondo memory stack, scheduler, auth plane, framework o runtime dependency; la memoria precedente è stata evoluta invece di essere duplicata.

Sorgenti: `src/randai/memory/randmind.js`, `src/randai/memory/engine.js`, `src/randai/memory/store.js`, `src/randai/memory/production-gate.js`, `src/randai/control/RandMindConsole.jsx`, `test/randai-block23-randmind-81-86.test.js`.

### Blocco 24 — RandBrain LIVE — 87–92 ✅

RandBrain è la facade/orchestratore superiore dell'intelligenza operativa. Non sostituisce né duplica i motori esistenti: compone `RandAISupervisor`, `AgentRegistry/MultiAgent`, `PermissionAutonomyEngine`, `LearningEngine`, Action Gateway e i quality/recovery gate già presenti.

Il routing è deterministico, pesato e minimale: classifica l'obiettivo nei domini `maintenance`, `knowledge`, `warehouse`, `software`, `analysis`, `procedure` e seleziona al massimo gli specialisti realmente utili. A parità non dipende dall'ordine accidentale dell'enum; task e contesto mantengono sempre `hotelId` esplicito.

Il reasoning graph canonico è `problem → evidence → hypothesis → plan → authorization → verification → recovery`. RandBrain rifiuta richieste senza evidenze verificabili, context cross-hotel e stime costo non valide. I livelli `READ_ONLY`, `SUGGEST`, `SAFE_EXECUTE`, `APPROVAL_REQUIRED` non possono auto-escalare: rischio high/critical richiede approvazione e una mutazione operativa può attraversare soltanto Action Gateway/RLS/RPC.

Il learning non introduce un secondo store: `RandBrainLearningAdapter` alimenta esclusivamente il `LearningEngine` già governato e solo con outcome verificati e identità di evidenza. Le candidate skill continuano a richiedere evidence threshold, evaluation/test e approvazione esplicita; nessuna auto-modifica silenziosa in produzione.

Il production gate è fail-closed e comprende facade canonica, routing, reasoning graph, autonomia, learning verificato, hotel isolation, Action Gateway, rollback, cost budget, benchmark e fault injection. I test simulano escalation critica, cost overrun e cross-hotel mismatch. RandControl mostra il contratto RandBrain nella sezione Ecosistema.

Non è stata aggiunta alcuna migration: Supervisor, Agents, Autonomy e Learning possiedono già i loro store/contratti canonici; creare una nuova autorità DB avrebbe duplicato responsabilità. Zombie scan 87–92: eliminata prima del merge l'ipotesi di un secondo failure-learning store e sostituita con adapter al `LearningEngine` esistente. Nessun nuovo scheduler, framework, vector DB o runtime dependency.

Sorgenti: `src/randai/randbrain/`, `src/randai/supervisor/`, `src/randai/agents/`, `src/randai/autonomy/`, `src/randai/learning/`, `src/randai/control/RandBrainConsole.jsx`, `test/randai-block24-randbrain-87-92.test.js`.

### Blocco 25 — RandUI LIVE — 93–97 ✅

RandUI consolida le primitive `src/randapp/ui.jsx`, i token e la geometria `rs-*` già esistenti: non introduce una seconda component library. `Shell.jsx` resta l'unico chrome autenticato e mantiene il punto `+` globale, la navigazione role-aware e RandAI integrato; RLS/RPC e RandCore restano le autorità.

Le identità Hotel Giò, ChocoHotel e Hotel Il Brigantino hanno un contratto versionato (`hotel-identity.js`, versione 1) che modifica esclusivamente l'accento visivo. System/Light/Dark condividono gli stessi token; la prima scelta predefinita è System e Light è una superficie completa, non un override parziale.

L'adaptive contract copre safe-area, `100dvh`, visual viewport/tastiera, mouse, touch, edge swipe del menu, portrait/landscape, tablet e desktop Windows. Sheet e modal gestiscono Escape, focus iniziale, focus trap e ripristino focus. Il visual gate usa Chromium e WebKit, screenshot, overflow, tema, touch target, rotazione e controlli runtime; la CI espone inoltre il gate nominato `RandUI visual quality contracts`.

Zombie scan 93–97: conservati i CSS feature-specific ancora importati e coperti da flussi operativi; nessuna eliminazione rischiosa o nuova dipendenza. Issues, Interventions, Planning Sale/Lavori, Warehouse, Home e RandAI continuano a usare Shell e primitive canoniche.

Sorgenti: `src/randapp/ui.jsx`, `src/randapp/ui-coherence.css`, `src/randapp/ui-material-glass.css`, `src/randapp/adaptive-layout.css`, `src/randapp/hotel-identity.js`, `src/randapp/theme.js`, `src/randapp/Shell.jsx`, `test/randai-block25-randui-93-97.test.js`, `test/e2e.mjs`, `test/device-acceptance.mjs`.

### Blocco 26 — RandAudio — 98 ✅ / LIVE deferred

RandAudio è una capability condivisa di RandAI, non un secondo assistente. L'adapter browser separa STT, TTS e registrazione perché il supporto non è uniforme; la UI RandAI abilita la dettatura solo dove disponibile e la lettura delle risposte dove supportata. Una trascrizione conserva provider, timestamp, confidence e `hotelId`, ma resta `USER_CONFIRMATION_REQUIRED`: viene inserita nel composer e diventa input operativo soltanto quando la persona la controlla e la invia.

Il benchmark di riferimento copre Android/Chromium, Windows/Chromium e iOS/WebKit. TTS è disponibile 3/3; STT nativo è 2/3 e manca su iOS/WebKit. Per questo il punto 98 è completato con l'esito previsto dalla roadmap ma RandAudio resta `PARTIAL`, esplicitamente deferred: nessun falso `LIVE`, nessun provider cloud scelto senza benchmark, nessun segreto client, audio persistente o costo ricorrente introdotto. Il gate potrà promuoverlo quando un adapter locale/cloud autorizzato supererà privacy, costo, qualità e copertura 3/3.

Zombie scan 98: nessun secondo sistema AI, storage audio, coda, permission plane o SDK provider. Il test audio sale resta indipendente perché misura un impianto fisico, non voce/STT/TTS.

Sorgenti: `src/randai/audio/`, `src/randai/RandAIAssistant.jsx`, `test/randai-block26-randaudio-98.test.js`.

### Blocco 27 — Viking Evaluation — 99 ✅ / pattern adoption

Il candidato “Viking” è stato identificato e fissato a **OpenViking 0.3.22** (`volcengine/OpenViking`), quindi valutato attraverso il Repo Radar canonico. Il runtime completo è stato respinto: progetto principale AGPL-3.0, maturità dichiarata alpha, nuovo servizio Python/context database, configurazione provider e sovrapposizione diretta con RandMind, RandGuide, Skill Engine, Authorized Context e osservabilità. Stelle e benchmark pubblicati restano segnali di discovery, non autorizzazione all'adozione.

La parte realmente migliore è stata adottata senza importare il nuovo stack: `ContextEngine` può produrre opzionalmente una proiezione stateless L0/L1/L2 delle sole evidenze autorizzate e hotel-scoped, con retrieval trace osservabile. Il contratto classico resta invariato per compatibilità; nessun secondo store, protocollo `viking://`, indice, worker, segreto client o dipendenza runtime è stato aggiunto.

Il manifest usa `EVALUATED`, non `LIVE`: il punto 99 certifica una decisione tecnica conclusa e l'adozione dei pattern utili, non finge che il prodotto esterno sia un modulo operativo Rand. RandControl mostra decisione, autorità preservate, costi evitati e production gate.

Zombie scan 99: la precedente voce `PLANNED` priva di specifica è stata sostituita dall'evaluation evidence-backed. Nessun componente canonico è stato eliminato perché OpenViking avrebbe duplicato responsabilità già coperte.

Sorgenti: `src/randai/viking/`, `src/randai/context/engine.js`, `src/randai/control/VikingConsole.jsx`, `test/randai-block27-viking-99.test.js`.

### Product completion — 100 ✅

Il punto 100 rende utilizzabile e verificabile ciò che i blocchi precedenti avevano costruito. RandAI espone ora **Funzioni** come percorso primario: Segnalazioni, RandGuide, RandMind, RandBrain, Viking e Media/manuali non sono più nascosti nella sola vista tecnica Ecosistema. Le console approfondite restano uniche e vengono raggiunte tramite collegamenti contestuali; non è nato un secondo frontend o design system.

RandMind riceve lo scope hotel reale della sessione amministrativa, eliminando lo stato vuoto causato da proprietà mancanti. RandCore Health usa RPC dedicate a RandAI che richiedono contemporaneamente utente autenticato, membership attiva, `can_access_admin` e ruolo esatto `RandAI`. Le RPC canoniche di RandApp non vengono ampliate: PIN operativo e sessione amministrativa restano separati intenzionalmente, così un accesso RandAI non acquisisce privilegi sul campo.

Il gate di completamento copre visibilità delle funzioni, propagazione dello scope hotel, contratto di accesso fail-closed, assenza di accesso `anon` e riuso delle autorità esistenti. Il Final Health Gate continua a mostrare lo stato reale delle evidenze e non viene forzato artificialmente a verde.

Sorgenti: `src/randai/control/CapabilitiesConsole.jsx`, `src/randai/control/EcosystemConsole.jsx`, `src/randai/control/RandCoreHealthConsole.jsx`, `supabase/migrations/20260904023000_randai_product_completion_access.sql`, `test/randai-product-completion-100.test.js`.

## Rand Control Plane

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Runtime agenti, workflow, MCP, memoria, knowledge e tool adapter possono evolvere dietro questo confine ma non ricevono autorità diretta su database, filesystem, shell o dati di altri hotel.

## RandAI Control Center

Route protetta: `/randai`. La console canonica integra WhatsApp, Segnalazioni, Tecnici, Worker/Automazioni, Log, Manutenzioni, Conoscenze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media/Drive, Sensori, Configurazione 360° ed Ecosistema con RandCore Health, Security Center, RandMind, RandBrain e Repo Radar.

## RandCore Point 1 — Eventi e webhook

Il primo punto del modello `event-driven` è ora predisposto con un contratto unico e separato dalle notifiche. `rand_domain_events` registra i fatti operativi in forma append-only, sempre con `hotel_id`, tipo evento, operazione, aggregato, timestamp e chiave di idempotenza. Il payload è volutamente minimale e non copia dati sensibili: i consumer possono risalire al record autorizzato usando l'identità dell'evento.

I domini operativi esistenti (`segnalazioni`, `interventi`, urgenze, planning, prenotazioni sale, promemoria, richieste magazzino, WhatsApp inbound e dispatch tecnici) emettono automaticamente eventi INSERT/UPDATE/DELETE quando le relative tabelle sono presenti. Gli eventi non sostituiscono Realtime: Realtime continua ad aggiornare l'interfaccia, mentre il registro serve per integrazioni, audit, retry e RandAI/RandCore.

`rand_webhook_subscriptions` e `rand_webhook_deliveries` sono il canale webhook predisposto per il service plane: endpoint solo HTTPS, segreto indicato tramite riferimento e mai salvato in chiaro, consegne idempotenti, stati `pending/processing/delivered/failed/dead_letter` e coda pronta per un worker con retry bounded. `notification_outbox` resta l'autorità delle notifiche push/WhatsApp/email e non viene duplicata.

Migration: `supabase/migrations/20260904090000_randcore_domain_events_webhook_foundation.sql`. Test: `test/randcore-domain-events.test.js`. Il worker di consegna outbound e la configurazione degli endpoint restano il passo successivo: non viene attivato alcun endpoint reale senza una destinazione e una policy approvate.

## RandCore Point 2 — Aggiornamenti realtime

Il contratto Realtime è stato riallineato al codice realmente usato dall'app. La pubblicazione `supabase_realtime` include ora, in modo idempotente e solo se la tabella esiste, tutte le tabelle client-visible che possiedono già un subscriber `postgres_changes`: operatività, planning, promemoria, notifiche lette, housekeeping, inventario, rifornimenti, sale, WhatsApp e dispatch tecnici.

Il frontend conserva i subscriber nei rispettivi bounded domain: non è stato creato un secondo bus globale e non è stato aggiunto polling. Gli eventi interni aggiornano la schermata interessata; i listener restano filtrati per hotel quando il dominio lo consente. Le tabelle service-only degli eventi RandCore e della coda webhook sono escluse intenzionalmente dalla pubblicazione pubblica.

Migration: `supabase/migrations/20260904100000_randcore_realtime_publication_contract.sql`. Test: `test/randcore-realtime-contract.test.js`. La query di produzione ha verificato la pubblicazione effettiva e ha rilevato/corretto le tabelle che il codice ascoltava ma che non erano ancora registrate.

## RandCore Point 3 — Worker, retry e recovery webhook

La coda webhook ora ha un worker reale: `supabase/functions/randcore-webhook-worker/index.ts`. Il worker viene invocato dal job `randcore-webhook-worker-1m`, termina immediatamente quando non ci sono consegne e usa sempre il secret già conservato nel service plane; nessun secret viene committato nel repository.

Ogni consegna viene acquisita con `FOR UPDATE SKIP LOCKED` e lease di 10 minuti, così due worker concorrenti non lavorano normalmente sulla stessa riga. Il payload è firmato con HMAC-SHA256, include `idempotency-key`, ha timeout di 10 secondi e ritenta solo errori di rete, timeout, 425, 429 e 5xx. Il limite è di 5 tentativi; secret mancanti, endpoint non validi e errori permanenti finiscono in `dead_letter` con errore troncato e senza dati sensibili nei log.

La migrazione crea anche le transizioni protette `delivered/pending/dead_letter`, con autorizzazione esclusiva al `service_role`. Il job è già attivo in produzione, ma con coda vuota non effettua chiamate esterne: le destinazioni HTTPS restano da configurare e approvare prima di una consegna reale.

Migration: `supabase/migrations/20260904110000_randcore_webhook_delivery_worker.sql`. Test: `test/randcore-webhook-worker.test.js`.

## Worker e automazioni

- `pulisci-richieste-urgenti-72h` — orario.
- `presence-auto-expire-7h20` — ogni 5 minuti.
- `diagnostic-retention-daily` — giornaliero.
- `weather-alert-worker-2h-daytime` — ogni 2 ore nella finestra diurna prevista.
- `sync-sensori-temperatura-secure` — ogni 30 minuti, HTTP timeout 20s.
- `randcore-monthly-full-check` — mensile, autodiagnosi completa 7-domain.
- `reminder-worker-1m` — event-driven, solo con promemoria attivi.
- `urgent-reminder-worker-30s` — event-driven temporaneo, solo con coda urgente pending.

Regola: event-driven prima del polling; nessun ghost worker sempre acceso senza motivo. RandMind non introduce worker di retention permanenti e RandBrain non introduce scheduler autonomi: usa i runtime e i gate già esistenti.

## Multi-hotel

ID canonici: `hotelgio`, `chocohotel`, `brigantino`. Ogni record operativo mantiene `hotel_id`; isolamento tramite membership, RLS, permission, vincoli relazionali, test cross-hotel e offline queue con scope originario.

## UI

RandApp è mobile-first. `src/randapp/Shell.jsx` è la sola sorgente del chrome autenticato. RandControl usa lo stesso sistema RandUI. Requisiti: safe-area iOS, `100dvh`, touch target ≥44×44, System/Light/Dark e nessun overflow orizzontale sui viewport supportati.

## Osservabilità

Sentry + OpenTelemetry + diagnostica interna restano le fonti canoniche. Costi, token e health sono misurati soltanto quando esiste una traccia reale; assenza del dato = `UNKNOWN/non misurato`.

## Quality gates

```bash
npm ci
npm audit --audit-level=high
npm run test:matrix
npm run test:critical
npm run test:multihotel
npm run test:production
npm run test:repo-radar
npm run test:core-health
npm run test:operations-security
npm run test:warehouse-integration
npm run test:lts
npm run test:health-evidence
npm run test:external-evidence
npm run test:full-health
npm run test:randguide
npm run test:randmind
npm run test:randbrain
npm run test:randui
npm run test:randaudio
npm run test:viking
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
npm run core:health
npm run core:external-evidence
RAND_LTS_COMMIT_SHA=<sha> npm run lts:attest
```

La CI deve restare verde su dependency audit, Quality Matrix, Critical Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, Chromium/WebKit, device acceptance, Health Evidence, External Evidence, Full Health contract, RandGuide, RandMind, RandBrain, RandUI, RandAudio, Viking Evaluation e attestazione LTS.

Regola di chiusura: un blocco è ✅ solo con codice canonico, DB/schema dove serve, wiring UI, isolamento, test dedicati, zombie scan, README coerente, migration applicate/verificate quando necessarie, CI completa verde e merge finale senza forzare `main`.

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/core/` — orchestrazione, Truth Map, Configuration, Health Evidence, Final Health Gate, Module Health e LTS Readiness.
- `src/randai/guidance/` — catalogo, ingestione, graph, authoring e production gate canonici di RandGuide.
- `src/randai/memory/` — MemoryEngine/Store e facade/governance canonica RandMind.
- `src/randai/randbrain/` — facade RandBrain, routing, reasoning graph, learning adapter, validation e production gate.
- `src/randai/supervisor/`, `src/randai/agents/`, `src/randai/autonomy/`, `src/randai/learning/` — motori canonici composti da RandBrain; non duplicati.
- `src/randai/control/` — Control Center, Operations, Security, Health, RandMind, RandBrain e Repo Radar.
- `src/randai/control-center/` — motore/proiezione read-only canonica.
- `src/reliability/` — safety/reliability 27+.
- `supabase/functions/` — boundary server e worker.
- `supabase/migrations/` — schema, RLS/RPC e migration versionate.
- `test/` e `scripts/` — contract, quality gate, E2E, device acceptance e attestazioni.

## Consolidamento storico

- PR #118 — Blocco 1.
- PR #123 — 1–16.
- PR #124 — 17–20.
- PR #125 — 21–24.
- PR #126 — 25–26.
- PR #127 — 27–30.
- PR #129 — 31–34.
- PR #130 — 35–38.
- PR #131 — 39–42.
- PR #132 — 43–46.
- PR #133 — 47–50.
- PR #150 — 51–54.
- PR #152 — 55–58.
- PR #153 — 59–62.
- PR #154 — 63–66.
- PR #155 — 67.
- PR #156 — 68–70.
- PR #157 — 71.
- PR #158 — 72.
- PR #159 — 73.
- PR #160 — 74–80 / RandGuide LIVE.
- PR #161 — 81–86 / RandMind LIVE.
- PR #162 — 87–92 / RandBrain LIVE.
- PR #163 — 93–97 / RandUI LIVE.
- PR #164 — 98 / RandAudio capability, LIVE deferred.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`. Progetto Vercel attivo: `apicehotel-manutenzionr`.
