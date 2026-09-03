# RandApp / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target obbligatori: iOS/iPadOS, Android e Windows. Il `hotel_id`, membership, RLS/RPC, Safe Write e audit restano confini di sicurezza canonici.

## Regole architetturali non negoziabili

- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun modello o frontend riceve `service_role`, PIN, refresh token o secret non necessari.
- Le scritture operative passano da Action Gateway / Safe Write e dall’autorità server.
- RLS/RPC Supabase sono il controllo finale: nascondere un bottone non è autorizzazione.
- Output AI, memoria, telemetria e risultati tecnici non diventano verità operativa senza verifica.
- `UNKNOWN` non significa `HEALTHY`.
- Niente secondi sistemi di navigazione, autorizzazione, offline queue, logging, scheduler o orchestrazione per la stessa responsabilità.
- Una parte viene eliminata come zombie solo dopo verifica di utilizzo e dipendenze.
- **Se esiste una soluzione nettamente migliore e più sicura, si sostituisce la debolezza invece di accumulare patch.**

## Stato roadmap consolidata

### Fondazione RandAI — 1–26 ✅

Core/Orchestrator, Tool Registry, Skill Engine, Directive Composer, Maintenance Knowledge, Procedure Assistant, Planner→Executor→Verifier, Durable Tasks, Scoped Memory, Authorized Context, Model Router, Knowledge Gaps, Smart Suggestions, Guided Procedures, Project Intelligence, Observability, Evaluation/Benchmark, Multi-Agent, Autonomy, Recovery, Software Engineering Agent, Learning, Discovery, Supervisor, Proactive AI e Control Center.

### Reliability / Production — 27–50 ✅

Operational Context, Scope Guard, Unified Validation, Safe Write/Action Gateway, Authorization & RLS Matrix, Audit/Reversibility, Offline/Retry/Concurrency, Import Safety, Verification Gate, Evidence Trust, Hybrid Memory/Knowledge Graph, Confidence/Risk, Plan Validator, Execution Policy, Recovery Budgets/Circuit Breakers, Failure Intelligence, Adversarial/Fault Injection, Production Gate, Canary/Rollback, Runtime Fuse, Drift Guard, SLO/Error Budget e Release Attestation.

### Blocco 13 — Ecosystem Truth, RandCore e RandControl — 51–54 ✅

51. **Ecosystem Truth Map** — `src/randai/core/ecosystem.js` classifica ogni modulo `LIVE`, `PARTIAL`, `BACKEND_ONLY`, `PLANNED`, `ZOMBIE` con evidenze verificabili.
52. **RandCore Manifest** — RandCore compone i contratti esistenti; non è un secondo orchestratore e non sostituisce RLS/RPC.
53. **RandControl 360°** — Ecosistema e configurazione sono integrati nel `RandAIControlCenter` canonico. Il prototipo di secondo Hub è stato eliminato.
54. **RandAI Configuration 360°** — configurazione non-secret, tipizzata, bounded, versionata e hotel-scoped. Le invarianti di sicurezza non sono disattivabili dalla UI.

Migration principali: `20260903143000_randai_runtime_configuration.sql` e hardening `20260903150000_randai_runtime_configuration_acl_hardening.sql`.

### Blocco 14 — Repo Radar 2.0 e Safe Adoption — 55–58 ✅

55. **Repo Radar 2.0** — `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`; stelle e popolarità servono soltanto alla discovery.
56. **Deep Repository Intelligence** — sicurezza, manutenzione, maturità, test/CI, compatibilità, performance, rollback, licenza e manutenibilità.
57. **Safe Adoption / Replacement Gate** — `ADD/REPLACE` solo con security + compatibility + benchmark + rollback verificati; nessuna installazione automatica.
58. **Repo Radar in RandControl** — scouting settimanale bounded, snapshot come artifact e nessuna seconda navigazione.

Sorgenti: `src/randai/discovery/repo-radar.js`, `repo-radar-catalog.js`, `RepoRadarConsole.jsx`, `scripts/repo-radar-snapshot.mjs`, `.github/workflows/repo-radar.yml`.

### Blocco 15 — RandCore Health & Full Audit 2.0 — 59–62 ✅

59. **Unified Health Snapshot** — stato, score, finding e drift canonici.
60. **Monthly Full Ecosystem Check** — audit Supabase mensile via `pg_cron` + audit code-side GitHub; nessun polling continuo.
61. **Findings, History & Drift** — storico append-only e confronto `BETTER / STABLE / WORSE / BASELINE`.
62. **RandControl Health Console** — score, copertura, finding, storico e check manuale dentro `Ecosistema`.

Il primo audit reale ha trovato 12 funzioni `SECURITY DEFINER` eseguibili da `anon`, producendo `CRITICAL 78/100`. Il finding è stato lasciato aperto fino alla revisione dei call-path invece di fare un revoke indiscriminato.

Sorgenti: `src/randai/core/health-snapshot.js`, `RandCoreHealthConsole.jsx`, `20260903153500_randcore_health_full_audit.sql`, `scripts/randcore-full-check.mjs`, `.github/workflows/randcore-monthly-health.yml`.

### Blocco 16 — Operations & Security — 63–66 ✅

63. **Rand Operations & Workers** — `randcore_worker_registry` censisce cron, edge worker ed event-driven worker con scopo, owner, schedulazione prevista, retry, pause e classe di costo. `randcore_operations_snapshot` sovrappone il registro a `pg_cron` e segnala job non censiti. `randcore_set_worker_active` permette pausa/riattivazione solo ai worker esplicitamente `pauseable` e solo ad admin autenticati. I promemoria restano event-driven: `reminder-worker-1m` e `urgent-reminder-worker-30s` non devono esistere senza lavoro.

La cadenza `presence-auto-expire-7h20` è stata ridotta da ogni minuto a `*/5 * * * *`: la soglia operativa è 7h20 e il polling al minuto non aggiunge beneficio proporzionato. Meteo resta ogni 2 ore nella finestra diurna; sensori ogni 30 minuti.

64. **Rand Security Center** — revisione mirata delle 12 ACL `SECURITY DEFINER`. Sei trigger/worker interni ora negano `PUBLIC`, `anon` e `authenticated`; sei RPC tecnici negano `PUBLIC/anon` e restano accessibili agli utenti autenticati con i controlli di membership già presenti. `randcore_security_snapshot` misura le esposizioni invece di dichiarare il sistema sicuro per convenzione. Verifica production: `anon SECURITY DEFINER = 0`, internal worker/trigger esposti ad authenticated = 0. Dopo l’hardening, il nuovo check RandCore è passato da **78/100 CRITICAL a 100/100 HEALTHY** sui domini attualmente misurabili.

65. **Rand Observability & Cost Center** — `randcore_observability_cost_snapshot` aggrega esclusivamente tracce reali, `cost_usd` espliciti e token registrati. Nessuna stima da listino. Le tracce prive di `hotel_id` sono conteggiate separatamente come debito di osservabilità; provider/modello sono mostrati solo quando esiste evidenza.

66. **Rand Repo / Module Health** — `src/randai/core/module-health.js` collega Truth Map, RandCore Health e decisioni Repo Radar senza confonderle: una decisione `ADD/KEEP/WATCH` non equivale a installazione e una repository popolare non rende automaticamente sano un modulo. La proiezione è mostrata dentro `RandCoreHealthConsole`.

Sorgenti principali 63–66: `src/randai/core/module-health.js`, `src/randai/control/SystemControlConsole.jsx`, `src/randai/control/RandSecurityConsole.jsx`, `src/randai/control/RandCoreHealthConsole.jsx`, `supabase/migrations/20260903160000_randcore_operations_security.sql` e `test/randai-block16-operations-security-63-66.test.js`.

Zombie scan 63–66: `SystemControlConsole` resta il live control canonico; RandCore Health resta storico/periodico; Repo Radar resta repository governance. Nessun secondo scheduler, observability stack, authorization plane o dashboard è stato creato. Nessuna nuova dipendenza runtime è stata introdotta.

## Rand Control Plane

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Runtime agenti, workflow, MCP, memoria, knowledge e tool adapter possono evolvere dietro questo confine ma non ricevono autorità diretta su database, filesystem, shell o dati di altri hotel.

## RandAI Control Center

Route protetta: `/randai`.

La console canonica integra Overview, WhatsApp, Segnalazioni, Tecnici, Worker/Automazioni, Log, Manutenzioni, Conoscenze, Bozze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media/Drive, Sensori, Configurazione 360° ed **Ecosistema con RandCore Health, Security Center e Repo Radar**.

`src/randai/control-center/` resta il motore/proiezione read-only coperto dai test di governance e non è zombie.

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

Regola: **event-driven prima del polling**; nessun ghost worker sempre acceso senza motivo.

## Multi-hotel

ID canonici: `hotelgio`, `chocohotel`, `brigantino`. Ogni record operativo mantiene `hotel_id`; isolamento tramite membership, RLS, permission, vincoli relazionali, test cross-hotel e offline queue con scope originario.

## UI

RandApp è mobile-first. `src/randapp/Shell.jsx` è la sola sorgente del chrome autenticato. RandControl può essere desktop-first responsive ma usa lo stesso sistema RandUI, non una seconda UI architecture. Requisiti: safe-area iOS, `100dvh`, touch target ≥44×44, System/Light/Dark e nessun overflow orizzontale sui viewport supportati.

## Osservabilità

Sentry + OpenTelemetry + diagnostica interna restano le fonti canoniche. Costi e token sono “misurati” solo se la traccia contiene valori reali; mancanza di dato = `UNKNOWN/non misurato`, mai una stima inventata.

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
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
```

La CI deve restare verde su dependency audit, Quality Matrix, Critical Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, Chromium/WebKit e device acceptance.

**Regola di chiusura:** un blocco è ✅ solo con codice canonico, DB/schema dove serve, wiring UI, isolamento, test dedicati, zombie scan, README coerente, migration applicate/verificate, CI completa verde e merge finale senza forzare `main`.

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/core/` — orchestrazione, Ecosystem Truth, Configuration, Health e Module Health.
- `src/randai/control/` — Control Center, Operations, Security, Health, Repo Radar e console operative.
- `src/randai/control-center/` — motore/proiezione read-only canonica.
- `src/randai/` — knowledge, memory, agents, evals, recovery, learning, discovery, supervisor e domini AI.
- `src/reliability/` — safety/reliability 27+.
- `supabase/functions/` — boundary server.
- `supabase/migrations/` — schema, RLS/RPC e migration versionate.
- `test/` e `scripts/` — contratti, quality gate, E2E e device acceptance.

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
- Blocco 16 — 63–66 / Operations, Security, Observability Cost e Repo/Module Health.

## Deploy

Il repository storico resta `Apicehotel/Apicehotel-Manutenzione`; il prodotto è RandApp/RandAI. Il progetto Vercel attivo documentato è `apicehotel-manutenzionr`.
