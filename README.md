# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target obbligatori: iOS/iPadOS, Android e Windows. `hotel_id`, membership, RLS/RPC, Safe Write e audit restano confini di sicurezza canonici.

## Regole architetturali non negoziabili

- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun modello o frontend riceve `service_role`, PIN, refresh token o secret non necessari.
- Le scritture operative passano da Action Gateway / Safe Write e dall’autorità server.
- RLS/RPC Supabase sono il controllo finale: nascondere un bottone non è autorizzazione.
- Output AI, memoria, telemetria e risultati tecnici non diventano verità operativa senza verifica.
- `UNKNOWN` non significa `HEALTHY`.
- Niente secondi sistemi di navigazione, autorizzazione, offline queue, logging, scheduler o orchestrazione per la stessa responsabilità.
- Una parte viene eliminata come zombie solo dopo verifica di utilizzo e dipendenze.
- Se esiste una soluzione nettamente migliore e più sicura, si sostituisce la debolezza invece di accumulare patch.

## Stato roadmap consolidata

### Fondazione RandAI — 1–26 ✅

Core/Orchestrator, Tool Registry, Skill Engine, Directive Composer, Maintenance Knowledge, Procedure Assistant, Planner→Executor→Verifier, Durable Tasks, Scoped Memory, Authorized Context, Model Router, Knowledge Gaps, Smart Suggestions, Guided Procedures, Project Intelligence, Observability, Evaluation/Benchmark, Multi-Agent, Autonomy, Recovery, Software Engineering Agent, Learning, Discovery, Supervisor, Proactive AI e Control Center.

### Reliability / Production — 27–50 ✅

Operational Context, Scope Guard, Unified Validation, Safe Write/Action Gateway, Authorization & RLS Matrix, Audit/Reversibility, Offline/Retry/Concurrency, Import Safety, Verification Gate, Evidence Trust, Hybrid Memory/Knowledge Graph, Confidence/Risk, Plan Validator, Execution Policy, Recovery Budgets/Circuit Breakers, Failure Intelligence, Adversarial/Fault Injection, Production Gate, Canary/Rollback, Runtime Fuse, Drift Guard, SLO/Error Budget e Release Attestation.

### Blocco 13 — Ecosystem Truth, RandCore e RandControl — 51–54 ✅

51. Ecosystem Truth Map.
52. RandCore Manifest.
53. RandControl 360°.
54. RandAI Configuration 360°.

### Blocco 14 — Repo Radar 2.0 e Safe Adoption — 55–58 ✅

55. Repo Radar 2.0.
56. Deep Repository Intelligence.
57. Safe Adoption / Replacement Gate.
58. Repo Radar in RandControl.

### Blocco 15 — RandCore Health & Full Audit 2.0 — 59–62 ✅

59. Unified Health Snapshot.
60. Monthly Full Ecosystem Check.
61. Findings, History & Drift.
62. RandControl Health Console.

### Blocco 16 — Operations & Security — 63–66 ✅

63. Rand Operations & Workers.
64. Rand Security Center.
65. Rand Observability & Cost Center.
66. Rand Repo / Module Health.

### Blocco 17 — Rand Warehouse Integration — 67 ✅

67. Il Magazzino resta bounded domain autonomo ma collegato a Interventi e RandAI. Lifecycle ricambi `requested → reserved → consumed/released/cancelled`, consumo atomico, protezioni cross-hotel e nessun secondo inventario.

### Blocco 18 — Final Ecosystem Gate & LTS — 68–70 ✅

68. Final Ecosystem / E2E Contract Gate.
69. Zombie & Duplication Purge.
70. Rand Ecosystem LTS 1.0.

Perimetro LTS obbligatorio: `randapp`, `randai`, `randcore`, `randcontrol`, `reporadar`, `warehouse`. Moduli deferred dichiarati: `RandGuide`, `RandMind`, `RandBrain`, `RandUI` (`PARTIAL`), `RandAudio` e `Viking` (`PLANNED`).

### Blocco 19 — Health Evidence Contract — 71 ✅

71. **RandCore Health Evidence Contract** — i sette domini canonici sono `database`, `security`, `workers`, `deploy`, `backup_restore`, `integrations`, `dependencies`. Ogni dominio espone evidenza `VERIFIED / STALE / UNKNOWN`, stato salute, score, sorgente, timestamp, freshness e confidence. `UNKNOWN` e `STALE` sono fail-closed e non entrano nella copertura verificata.

`100/100` descrive soltanto la qualità dei domini verificati e non implica copertura totale. Un aggregate può essere `HEALTHY` solo con 7/7 evidenze fresche e verificate. Il database misura direttamente `database`, `security`, `workers`; la CI misura `deploy` e `dependencies`; `backup_restore` e `integrations` non vengono falsamente promossi.

Sorgenti: `src/randai/core/health-evidence.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `scripts/randcore-full-check.mjs`, `supabase/migrations/20260903173000_randcore_health_evidence_contract.sql`, `test/randai-block19-health-evidence-71.test.js`.

### Blocco 20 — External Evidence Bridge — 72

72. **RandCore External Evidence Bridge** — le prove prodotte fuori dal database entrano in RandCore tramite un solo canale service-only, append-only e bounded. La tabella `randcore_external_health_evidence` accetta esclusivamente i domini esterni `deploy`, `backup_restore`, `integrations`, `dependencies`; browser, `anon` e utenti autenticati non hanno accesso diretto. La RPC `randcore_record_external_health_evidence` valida dominio, stato, score, sorgente, timestamp, freshness, commit ed envelope prima dell'insert.

RandControl riceve le ultime evidenze esterne attraverso `randcore_get_health_history` e le compone con lo snapshot runtime usando `buildExternalEvidenceSnapshot` + `mergeHealthEvidenceSnapshots`, cioè lo stesso contratto canonico del punto 71. Una prova fresca vince una prova `UNKNOWN`; una prova stale non diventa verificata; `database/security/workers` non possono essere iniettati dal bridge esterno.

La CI genera anche `artifacts/randcore-external-evidence.json` dopo build, browser/device gate e Health Evidence. Oggi pubblica prove reali per `deploy` e `dependencies`. Il publisher può usare `RANDCORE_SUPABASE_URL` + `RANDCORE_SERVICE_ROLE_KEY` solo nel runner/backend; nessun secret entra nel bundle. Se entrambe le variabili non sono configurate, viene prodotto l'artifact ma non viene simulata la pubblicazione. Una configurazione parziale fallisce chiusa.

`backup_restore` resta `UNKNOWN` finché non esiste una prova reale di backup/restore; `integrations` resta `UNKNOWN` finché non esiste un health probe attendibile delle integrazioni. Il Blocco 72 prepara entrambe le connessioni senza inventare un 7/7.

Zombie/duplication scan 72: nessun secondo health stack, scheduler, dashboard, authorization plane o dipendenza runtime. Il bridge estende il contratto 71 invece di duplicarlo.

Sorgenti: `src/randai/core/health-evidence.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `scripts/randcore-external-evidence.mjs`, `supabase/migrations/20260903180500_randcore_external_evidence_bridge.sql`, `test/randai-block20-external-evidence-72.test.js`, `.github/workflows/ci.yml`.

## Rand Control Plane

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Runtime agenti, workflow, MCP, memoria, knowledge e tool adapter possono evolvere dietro questo confine ma non ricevono autorità diretta su database, filesystem, shell o dati di altri hotel.

## RandAI Control Center

Route protetta: `/randai`.

La console canonica integra Overview, WhatsApp, Segnalazioni, Tecnici, Worker/Automazioni, Log, Manutenzioni, Conoscenze, Bozze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media/Drive, Sensori, Configurazione 360° ed Ecosistema con RandCore Health, Security Center e Repo Radar.

## Worker e automazioni

Registro canonico attuale:

- `pulisci-richieste-urgenti-72h` — orario.
- `presence-auto-expire-7h20` — ogni 5 minuti.
- `diagnostic-retention-daily` — giornaliero.
- `weather-alert-worker-2h-daytime` — ogni 2 ore nella finestra diurna prevista.
- `sync-sensori-temperatura-secure` — ogni 30 minuti.
- `randcore-monthly-full-check` — mensile.
- `reminder-worker-1m` — event-driven, esiste solo con promemoria attivi.
- `urgent-reminder-worker-30s` — event-driven temporaneo, esiste solo con coda urgente pending.

Regola: event-driven prima del polling; nessun ghost worker sempre acceso senza motivo.

## Multi-hotel

ID canonici: `hotelgio`, `chocohotel`, `brigantino`. Ogni record operativo mantiene `hotel_id`; isolamento tramite membership, RLS, permission, vincoli relazionali, test cross-hotel e offline queue con scope originario.

## UI

RandApp è mobile-first. `src/randapp/Shell.jsx` è la sola sorgente del chrome autenticato. RandControl può essere desktop-first responsive ma usa lo stesso sistema RandUI. Requisiti: safe-area iOS, `100dvh`, touch target ≥44×44, System/Light/Dark e nessun overflow orizzontale sui viewport supportati.

## Osservabilità

Sentry + OpenTelemetry + diagnostica interna restano le fonti canoniche. Costi, token e health sono “misurati” solo se esiste una traccia reale; assenza del dato = `UNKNOWN/non misurato`.

## Quality gates

Prima di chiudere modifiche critiche:

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
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
npm run core:health
npm run core:external-evidence
RAND_LTS_COMMIT_SHA=<sha> npm run lts:attest
```

La CI deve restare verde su dependency audit, Quality Matrix, Critical Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, Chromium/WebKit, device acceptance, Health Evidence, External Evidence artifact e attestazione LTS.

Regola di chiusura: un blocco è ✅ solo con codice canonico, DB/schema dove serve, wiring UI, isolamento, test dedicati, zombie scan, README coerente, migration applicate/verificate quando necessarie, CI completa verde e merge finale senza forzare `main`.

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/core/` — orchestrazione, Ecosystem Truth, Configuration, Health, Health Evidence, Module Health e LTS Readiness.
- `src/randai/control/` — Control Center, Operations, Security, Health, Repo Radar e console operative.
- `src/randai/control-center/` — motore/proiezione read-only canonica.
- `src/randai/` — knowledge, memory, agents, evals, recovery, learning, discovery, supervisor e domini AI.
- `src/reliability/` — safety/reliability 27+.
- `supabase/functions/` — boundary server.
- `supabase/migrations/` — schema, RLS/RPC e migration versionate.
- `test/` e `scripts/` — contratti, quality gate, E2E, device acceptance, Health Evidence, External Evidence e attestation LTS.

## Consolidamento storico

- PR #118 — Blocco 1.
- PR #123 — consolidamento 1–16; #120/#121/#122 superseded.
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
- Blocco 20 — 72 / RandCore External Evidence Bridge.

## Deploy

Il repository è `Apicehotel/Apicehotel-Manutenzione`; il prodotto è RandApp/RandAI. Il progetto Vercel attivo documentato è `apicehotel-manutenzionr`.
