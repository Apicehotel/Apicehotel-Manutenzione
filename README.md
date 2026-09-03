# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target obbligatori: iOS/iPadOS, Android e Windows. `hotel_id`, membership, RLS/RPC, Safe Write e audit restano confini di sicurezza canonici.

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

Perimetro LTS 1.0 originario: `randapp`, `randai`, `randcore`, `randcontrol`, `reporadar`, `warehouse`. A quella release `RandGuide`, `RandMind`, `RandBrain`, `RandUI` erano `PARTIAL`, `RandAudio` e `Viking` `PLANNED`. Le promozioni successive sono evidence-backed: dal Blocco 22 `RandGuide` è `LIVE`; dal Blocco 23 `RandMind` è `LIVE`; dal Blocco 24 `RandBrain` è `LIVE` quando il relativo gate finale è verde.

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

## Rand Control Plane

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Runtime agenti, workflow, MCP, memoria, knowledge e tool adapter possono evolvere dietro questo confine ma non ricevono autorità diretta su database, filesystem, shell o dati di altri hotel.

## RandAI Control Center

Route protetta: `/randai`. La console canonica integra WhatsApp, Segnalazioni, Tecnici, Worker/Automazioni, Log, Manutenzioni, Conoscenze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media/Drive, Sensori, Configurazione 360° ed Ecosistema con RandCore Health, Security Center, RandMind, RandBrain e Repo Radar.

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
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
npm run core:health
npm run core:external-evidence
RAND_LTS_COMMIT_SHA=<sha> npm run lts:attest
```

La CI deve restare verde su dependency audit, Quality Matrix, Critical Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, Chromium/WebKit, device acceptance, Health Evidence, External Evidence, Full Health contract, RandGuide, RandMind, RandBrain e attestazione LTS.

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

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`. Progetto Vercel attivo: `apicehotel-manutenzionr`.
