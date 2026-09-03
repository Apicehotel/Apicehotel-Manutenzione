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

Migration principali: `20260903143000_randai_runtime_configuration.sql` e `20260903150000_randai_runtime_configuration_acl_hardening.sql`.

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

Il primo audit reale ha trovato 12 funzioni `SECURITY DEFINER` eseguibili da `anon`, producendo `CRITICAL 78/100`. Il Blocco 16 ha poi chiuso il finding in modo mirato portando il controllo a `100/100 HEALTHY` sui domini realmente misurati.

Sorgenti: `src/randai/core/health-snapshot.js`, `RandCoreHealthConsole.jsx`, `20260903153500_randcore_health_full_audit.sql`, `scripts/randcore-full-check.mjs`, `.github/workflows/randcore-monthly-health.yml`.

### Blocco 16 — Operations & Security — 63–66 ✅

63. **Rand Operations & Workers** — registro canonico worker/cron, pause solo dove sicure, reminder event-driven, meteo e sensori con cadenze bounded. `presence-auto-expire-7h20` è stato ridotto da ogni minuto a ogni 5 minuti.
64. **Rand Security Center** — revisione mirata delle 12 ACL `SECURITY DEFINER`; `anon SECURITY DEFINER = 0`, worker/trigger interni non esposti agli utenti autenticati.
65. **Rand Observability & Cost Center** — aggrega soltanto costi/token realmente registrati; niente stime inventate.
66. **Rand Repo / Module Health** — collega Truth Map, RandCore Health e Repo Radar mantenendo separate salute modulo e decisione repository.

Sorgenti principali: `src/randai/core/module-health.js`, `SystemControlConsole.jsx`, `RandSecurityConsole.jsx`, `RandCoreHealthConsole.jsx`, `20260903160000_randcore_operations_security.sql`, `test/randai-block16-operations-security-63-66.test.js`.

Zombie scan 63–66: nessun secondo scheduler, observability stack, authorization plane o dashboard è stato creato.

### Blocco 17 — Rand Warehouse Integration — 67 ✅

67. **Rand Warehouse Integration** — il Magazzino resta un bounded domain autonomo ma il collegamento con Interventi e RandAI è esplicito e governato. Vengono riusati `inventory_items`, `inventory_movements`, seriali/compatibilità/trasferimenti/inventari fisici e `inventory_intervention_parts`; nessun secondo inventario.

Lifecycle ricambi: `requested → reserved → consumed/released/cancelled`, con consumo atomico e protezioni sulla chiusura/cancellazione dell’intervento. Le letture frontend sono esplicitamente hotel-scoped e la subscription realtime scarta eventi cross-hotel. RandAI riceve un envelope `resource.type = intervention` con evidenza Magazzino bounded e `readOnly: true`; nessuna funzione di scrittura stock viene esportata nel provider di evidenza.

Sorgenti: `src/inventory-intervention-data.js`, `src/randai/context/warehouse-evidence.js`, `src/randai/context/envelope.js`, `src/randapp/operations/InterventionsView.jsx`, `src/randai/RandAIAssistant.jsx`, `20260901112200_inventory_block3_intervention_parts.sql`, `test/randai-block17-warehouse-integration-67.test.js`.

### Blocco 18 — Final Ecosystem Gate & LTS — 68–70 ✅

68. **Final Ecosystem / E2E Contract Gate** — `src/randai/core/lts-readiness.js` definisce il perimetro minimo obbligatorio della release LTS (`RandApp`, `RandAI`, `RandCore`, `RandControl`, `Repo Radar`, `Rand Warehouse`). Un modulo richiesto non `LIVE`, senza evidenza o uno zombie canonico bloccano la certificazione. La Truth Map è stata riconciliata con il Blocco 17: `Rand Warehouse` è ora `LIVE` con evidenze reali.

69. **Zombie & Duplication Purge** — nessuna eliminazione cosmetica. `src/App.jsx` e `src/housekeeping.jsx` sono compatibility shim verso le implementazioni canoniche e restano intenzionalmente. Il campo legacy `Serve pezzo` nelle Segnalazioni rimane intake locale e non è autorità stock: non consuma `inventory_movements` e non bypassa le RPC Magazzino. La regola finale è zero zombie canonici, non zero file di compatibilità.

70. **Rand Ecosystem LTS 1.0** — la CI genera `artifacts/rand-ecosystem-lts-1.0.json` soltanto dopo security audit, Quality Matrix, Critical Gate, multi-hotel, production confidence, build/bundle, contratti, Chromium/WebKit e device acceptance. L’attestazione è legata al commit, verifica l’esistenza delle evidenze dei moduli inclusi ed elenca esplicitamente i moduli deferred anziché promuoverli artificialmente a `LIVE`.

Perimetro LTS obbligatorio: `randapp`, `randai`, `randcore`, `randcontrol`, `reporadar`, `warehouse`.

Moduli dichiaratamente deferred alla LTS 1.0 finché non vengono consolidati con roadmap dedicate: `RandGuide`, `RandMind`, `RandBrain`, `RandUI` (`PARTIAL`), `RandAudio` e `Viking` (`PLANNED`). Questo non è un falso completamento: la roadmap 1–70 è chiusa, mentre le capability future restano visibili nella Truth Map.

Sorgenti: `src/randai/core/lts-readiness.js`, `scripts/rand-lts-attestation.mjs`, `test/randai-block18-lts-68-70.test.js`, `.github/workflows/ci.yml`.

### Blocco 19 — Health Evidence Contract — 71

71. **RandCore Health Evidence Contract** — i sette domini canonici sono ora un unico contratto: `database`, `security`, `workers`, `deploy`, `backup_restore`, `integrations`, `dependencies`. Ogni dominio espone stato dell'evidenza (`VERIFIED / STALE / UNKNOWN`), stato salute, score, sorgente, timestamp, freshness e confidence. `UNKNOWN` e `STALE` sono fail-closed e non entrano nella copertura verificata.

Il significato di `100/100` è stato corretto: lo score descrive soltanto le evidenze realmente verificate e non implica più copertura totale. La console mostra separatamente score, domini valutati, copertura verificata, stale/unknown e confidence. Un aggregate può essere `HEALTHY` solo con **7/7 evidenze fresche e verificate**; 3/7 sani restano esplicitamente `DEGRADED` per incompletezza di evidenza.

Il precedente disallineamento è stato eliminato: il check SQL usava i sette domini operativi mentre lo snapshot CI usava una tassonomia diversa (`ecosystem`, `repo_radar`, `source_control`, ecc.). `src/randai/core/health-evidence.js` è ora l'autorità canonica; il CI riusa quei sette domini e genera `randcore-health-evidence-<sha>` dopo browser/device gate. Il merge di snapshot è predisposto per combinare in futuro evidenza runtime Supabase e CI scegliendo la prova fresca/verificata per dominio, senza creare un secondo health stack.

La migration `20260903173000_randcore_health_evidence_contract.sql` porta il check runtime al contratto v2. Il database può verificare direttamente `database`, `security` e `workers`; `deploy`, `backup_restore`, `integrations` e `dependencies` restano `UNKNOWN` in quel singolo snapshot se non hanno una prova esterna fresca. Il check CI può verificare `deploy` e `dependencies`; backup/restore e integrazioni non vengono falsamente promossi.

Zombie/duplication scan 71: nessun nuovo scheduler, dashboard o provider parallelo; la tassonomia duplicata del vecchio script CI è stata sostituita dal contratto canonico. Nessuna nuova dipendenza runtime o repository esterna è necessaria.

Sorgenti: `src/randai/core/health-evidence.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `scripts/randcore-full-check.mjs`, `supabase/migrations/20260903173000_randcore_health_evidence_contract.sql`, `test/randai-block19-health-evidence-71.test.js`, `.github/workflows/ci.yml`.

## Rand Control Plane

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Runtime agenti, workflow, MCP, memoria, knowledge e tool adapter possono evolvere dietro questo confine ma non ricevono autorità diretta su database, filesystem, shell o dati di altri hotel.

## RandAI Control Center

Route protetta: `/randai`.

La console canonica integra Overview, WhatsApp, Segnalazioni, Tecnici, Worker/Automazioni, Log, Manutenzioni, Conoscenze, Bozze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media/Drive, Sensori, Configurazione 360° ed Ecosistema con RandCore Health, Security Center e Repo Radar.

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
npm run test:warehouse-integration
npm run test:lts
npm run test:health-evidence
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
npm run core:health
RAND_LTS_COMMIT_SHA=<sha> npm run lts:attest
```

La CI deve restare verde su dependency audit, Quality Matrix, Critical Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, Chromium/WebKit, device acceptance, snapshot Health Evidence e generazione dell’attestazione LTS.

**Regola di chiusura:** un blocco è ✅ solo con codice canonico, DB/schema dove serve, wiring UI, isolamento, test dedicati, zombie scan, README coerente, migration applicate/verificate quando necessarie, CI completa verde e merge finale senza forzare `main`.

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/core/` — orchestrazione, Ecosystem Truth, Configuration, Health, Health Evidence, Module Health e LTS Readiness.
- `src/randai/control/` — Control Center, Operations, Security, Health, Repo Radar e console operative.
- `src/randai/control-center/` — motore/proiezione read-only canonica.
- `src/randai/` — knowledge, memory, agents, evals, recovery, learning, discovery, supervisor e domini AI.
- `src/reliability/` — safety/reliability 27+.
- `supabase/functions/` — boundary server.
- `supabase/migrations/` — schema, RLS/RPC e migration versionate.
- `test/` e `scripts/` — contratti, quality gate, E2E, device acceptance, Health Evidence e attestation LTS.

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
- PR #154 — 63–66 / Operations, Security, Observability Cost e Repo/Module Health.
- PR #155 — 67 / Rand Warehouse Integration.
- PR #156 — 68–70 / Final Ecosystem Gate, Zombie/Duplication Purge e Rand Ecosystem LTS 1.0.
- Blocco 19 — 71 / RandCore Health Evidence Contract.

## Deploy

Il repository storico resta `Apicehotel/Apicehotel-Manutenzione`; il prodotto è RandApp/RandAI. Il progetto Vercel attivo documentato è `apicehotel-manutenzionr`.
