# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 multi-hotel per **Hotel Giò**, **Chocohotel** e **Hotel Il Brigantino**. Supabase/Postgres resta il system of record. L'ecosistema Rand è progettato per iOS/iPadOS, Android e Windows con isolamento esplicito per `hotel_id`, membership, RLS/RPC e test cross-hotel.

## Regole architetturali non negoziabili

- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun modello riceve `service_role`, PIN, refresh token o secret non necessari.
- Le scritture operative passano da Action Gateway / Safe Write e dall'autorità server.
- RLS/RPC Supabase restano il controllo finale: nascondere un bottone non è autorizzazione.
- Output AI, telemetria, memoria e risultati tecnici non diventano verità operativa senza verifica.
- Nessun widening implicito: globale significa esplicitamente globale.
- Niente secondi sistemi di navigazione, autorizzazione, offline queue, logging o orchestrazione per la stessa responsabilità.
- Una parte viene eliminata come zombie solo se inutilizzata, irraggiungibile o sostituita da una sorgente canonica migliore.
- **Se esiste una soluzione nettamente migliore e più sicura, si sostituisce la debolezza invece di accumulare patch.**

## Stato roadmap RandAI / Reliability

### Fondazione RandAI — 1–26 ✅

1. Core / Orchestrator.
2. Tool Registry.
3. Skill Engine.
4. Directive Composer.
5. Maintenance Knowledge Engine.
6. Procedure Assistant.
7. Planner → Executor → Verifier.
8. Durable Tasks.
9. Scoped Memory Engine.
10. Authorized Context Engine.
11. Model Router.
12. Knowledge Gaps.
13. Smart Maintenance Suggestions 2.0.
14. Guided Procedures 2.0.
15. Project Intelligence 2.0.
16. Observability 2.0.
17. Evaluation / Benchmark 2.0.
18. Multi-Agent 2.0.
19. Permission / Autonomy 2.0.
20. Recovery / Self-Correction 2.0.
21. Software Engineering Agent 2.0.
22. Learning Engine 2.0.
23. Skill / Tool Discovery 2.0.
24. RandAI Supervisor 2.0.
25. Proactive RandAI 2.0.
26. Control Center 2.0.

### Reliability / Production — 27–50 ✅

27. Operational Context Layer 2.0.
28. Context & Scope Guard 2.0.
29. Unified Validation Layer 2.0.
30. Safe Write Engine / Action Gateway 2.0.
31. Authorization & RLS Verification Matrix.
32. Audit & Reversible Operations.
33. Offline / Retry / Concurrency Hardening.
34. Import Safety Pipeline.
35. Verification Gate 2.0.
36. Evidence & Knowledge Trust.
37. Hybrid Memory + Knowledge Graph Production.
38. Operational Confidence & Risk Engine.
39. Plan Validator 2.0.
40. Action Gateway 3.0 / Execution Policy.
41. Recovery Budgets & Circuit Breakers.
42. Failure Intelligence & Root Cause Engine.
43. Adversarial Reliability Testing.
44. Fault Injection & Chaos Safety.
45. Production Release Gate.
46. Canary / Safe Rollout & Automatic Rollback.
47. Runtime Capability Fuse / Emergency Stop.
48. Configuration & Policy Drift Guard.
49. SLO & Error Budget Guard.
50. Release Attestation / Evidence Binding.

### Blocco 13 — Ecosystem Truth, RandCore e RandControl — 51–54 ✅

51. **Ecosystem Truth Map** — `src/randai/core/ecosystem.js` mantiene il manifesto canonico dei moduli Rand con stati `LIVE`, `PARTIAL`, `BACKEND_ONLY`, `PLANNED`, `ZOMBIE` ed evidenze verificabili. Un modulo non può essere dichiarato `LIVE` senza evidenza concreta.
52. **RandCore Manifest** — RandCore non è un secondo orchestratore: compone i contratti esistenti e centralizza la verità dell'ecosistema. Duplicati e falsi `LIVE` falliscono chiuso.
53. **RandControl 360°** — Ecosistema e Configurazione sono integrati direttamente nel `RandAIControlCenter` canonico. Il prototipo `RandAIControlHub` è stato rimosso perché avrebbe creato un secondo livello di navigazione.
54. **RandAI Configuration 360°** — configurazione non-secret, tipizzata, bounded, versionata e hotel-scoped. Provider/modello, fallback, budget, autonomia e recovery sono configurabili; le invarianti di sicurezza restano bloccate dal codice.

Sorgenti principali 51–54: `src/randai/core/ecosystem.js`, `src/randai/core/configuration.js`, `src/randai/control/EcosystemConsole.jsx`, `src/randai/control/RandAIConfigurationConsole.jsx`, `src/randai/control/RandAIControlCenter.jsx`, `supabase/migrations/20260903143000_randai_runtime_configuration.sql`, `supabase/migrations/20260903150000_randai_runtime_configuration_acl_hardening.sql` e `test/randai-block13-ecosystem-51-54.test.js`.

La configurazione runtime usa `randai_runtime_config` e `randai_runtime_config_history`. Le scritture dirette dal browser sono revocate: ogni modifica ammessa passa da `randai_set_runtime_config`, verifica membership RandAI per hotel, usa allowlist delle chiavi e optimistic version fence. API key, token, `service_role` e credenziali non appartengono a questa tabella. La migration è stata applicata e verificata sul database multi-hotel; l'ACL del nuovo RPC è stata ulteriormente hardenizzata per negare `anon` e consentire solo i ruoli esplicitamente previsti.

Le protezioni `approved_only`, `verified_learning_only`, `require_confirmation_high_risk` e `release_gate_required` sono intenzionalmente non modificabili dalla UI.

Zombie scan 51–54: `src/randai/control-center/` resta vivo perché è il motore/proiezione read-only coperto dai test di governance. `RandAIControlHub.jsx` è stato invece rimosso dopo l'integrazione delle nuove sezioni nel Control Center canonico; sono stati eliminati anche i relativi stili `rch-*`.

### Blocco 14 — Repo Radar 2.0 e Safe Adoption — 55–58 ✅

55. **Repo Radar 2.0** — la valutazione repository usa il vocabolario canonico `KEEP`, `UPGRADE`, `REPLACE`, `ADD`, `REJECT`, `WATCH`. Stelle e popolarità servono solo alla discovery e non entrano nel punteggio di adozione. Lo scouting settimanale usa query GitHub bounded e aggiunge al massimo 15 candidate automatiche per ciclo.
56. **Deep Repository Intelligence** — `src/randai/discovery/repo-radar.js` valuta sicurezza, manutenzione, maturità, test/CI, compatibilità, performance, rollback e manutenibilità. Repository archiviate, non mantenute, con licenza non ammessa/sconosciuta, vulnerabilità critiche note o gate security/compatibility falliti vengono bloccate. Le repository scoperte automaticamente partono sempre con gate sconosciuti e quindi `WATCH`: popolarità e metadati non possono auto-promuoverle.
57. **Safe Adoption / Replacement Gate** — `ADD` e `REPLACE` richiedono gate security, compatibility, benchmark e rollback tutti verdi. `REPLACE` richiede inoltre target canonico verificato e superiorità misurabile rispetto allo score reale dell'incumbent; nessuna repository viene installata o sostituita automaticamente.
58. **Repo Radar in RandControl** — la vista governata è integrata dentro `Ecosistema`, quindi non nasce un secondo dashboard o una seconda navigazione. `.github/workflows/repo-radar.yml` esegue discovery/scouting ogni settimana con permesso GitHub `contents: read` e conserva lo snapshot come artifact per 90 giorni; `scripts/repo-radar-snapshot.mjs` arricchisce i candidati con metadati GitHub senza introdurre dipendenze runtime.

Catalogo iniziale governato: Sentry/OpenTelemetry `KEEP`; Promptfoo, MCP TypeScript SDK e MCP-Scan possono risultare `ADD` solo perché i gate dichiarati sono completi; LightRAG, Graphiti, Mem0, Mastra e Trigger.dev restano `WATCH` finché mancano benchmark/evidenze; OpenFGA è `REJECT` nell'architettura attuale perché introdurrebbe un secondo authorization plane.

Zombie scan 55–58: `DiscoveryEngine` resta canonico per skill/tool discovery. Repo Radar non lo duplica: aggiunge la governance specifica delle repository e riusa RandControl esistente. Nessun installer automatico, secondo registry, secondo scheduler applicativo o nuova dipendenza è stato introdotto.

Sorgenti principali 55–58: `src/randai/discovery/repo-radar.js`, `src/randai/discovery/repo-radar-catalog.js`, `src/randai/control/RepoRadarConsole.jsx`, `scripts/repo-radar-snapshot.mjs`, `.github/workflows/repo-radar.yml` e `test/randai-block14-repo-radar-55-58.test.js`.

### Blocco 15 — RandCore Health & Full Audit 2.0 — 59–62 ✅

59. **Unified Health Snapshot** — `src/randai/core/health-snapshot.js` normalizza stato, score, finding e drift. Il controllo non duplica `SystemControlConsole`: il live control resta istantaneo, RandCore conserva snapshot periodici e confrontabili.
60. **Monthly Full Ecosystem Check** — Supabase esegue `randcore-monthly-full-check` una volta al mese tramite `pg_cron`; `.github/workflows/randcore-monthly-health.yml` esegue inoltre l'audit code-side mensile con dependency audit, quality gate, test, build, bundle check e snapshot artifact. Nessun polling continuo viene introdotto.
61. **Findings, History & Drift** — `randcore_health_checks` e `randcore_health_findings` conservano storico append-only; il frontend confronta ultimo e precedente check e segnala `BETTER`, `STABLE`, `WORSE` o `BASELINE`. I domini senza evidenza automatica restano `UNKNOWN`: un'assenza di telemetria non diventa falsamente verde.
62. **RandControl Health Console** — `RandCoreHealthConsole` è integrata dentro la sezione `Ecosistema` già canonica. Gli admin possono lanciare un check manuale controllato, consultare score, copertura, finding e storico; non nasce un secondo dashboard.

La migration `20260903153500_randcore_health_full_audit.sql` è stata applicata su Apice MultiHotel. Le tabelle sono RLS-protected e read-only dal browser; la scrittura avviene soltanto attraverso funzioni governate. `randcore_run_health_check_internal` non è eseguibile da `anon` o `authenticated`, mentre il trigger manuale richiede un admin RandApp autenticato. È già predisposto un endpoint service-role-only per futura fusione degli snapshot CI senza consegnare credenziali al frontend.

Il primo audit reale non è stato forzato a verde: ha rilevato debito di sicurezza preesistente sulle ACL `SECURITY DEFINER`, dimostrando che il nuovo health layer segnala problemi reali invece di nasconderli. Tali finding non vengono corretti in massa senza verifica delle chiamate perché un revoke indiscriminato potrebbe interrompere flussi operativi.

Zombie scan 59–62: `SystemControlConsole` resta canonico per worker/anomalie/audit live; RandCore Health è storico/periodico. Nessun secondo observability stack, scheduler applicativo o store parallelo è stato aggiunto.

Sorgenti principali 59–62: `src/randai/core/health-snapshot.js`, `src/randai/control/RandCoreHealthConsole.jsx`, `supabase/migrations/20260903153500_randcore_health_full_audit.sql`, `scripts/randcore-full-check.mjs`, `.github/workflows/randcore-monthly-health.yml` e `test/randai-block15-core-health-59-62.test.js`.

## Rand Control Plane

Il confine di sicurezza resta:

`Hotel isolation → Identity → Permissions → Policies → Safe Write → Audit`

Dietro questo confine possono evolvere runtime agenti, workflow, MCP, memoria, knowledge e tool adapter senza ottenere autorità diretta su database, filesystem, shell o dati di altri hotel.

## Runtime Safety Layer

- Identity/Auth server-side per `/randai`.
- Hotel isolation esplicita in conoscenza, memoria, context, guidance, gap, approval, recovery, learning, supervisor, proactive, Control Center e write.
- Safe write con approval + idempotenza + optimistic version fence + read-back + audit.
- Plan readiness: tool, permission, prerequisiti e scope devono essere verificati prima dell'esecuzione.
- Execution policy: `AUTO/REVIEW/BLOCK`; rischio alto/critico non può aggirare review o blocco.
- Offline/concurrency: retry solo dopo riconciliazione; nessuna promessa fittizia di exactly-once.
- Recovery bounded per tentativi, tempo e costo; circuit breaker contro failure storm.
- Failure intelligence hotel-scoped: un successo in Giò non diventa automaticamente una regola per Chocohotel.
- Adversarial/fault injection deterministici per testare failure mode senza rendere flaky la CI.
- Production gate + canary/rollback per scope.
- Runtime fuse per fermare capability specifiche senza spegnere tutto RandAI.
- Drift/SLO/error budget impediscono di considerare sano un runtime degradato.
- Release attestation lega commit, configurazione e check verdi.

## RandAI Control Center

Route protetta: `/randai`.

Il Control Center è la console amministrativa canonica. Integra Overview, WhatsApp, Segnalazioni, Tecnici, Worker, Log, Manutenzioni, Conoscenze, Bozze, Approvazioni, Archivio, Impianti, Scadenze, Regole, Anomalie, Costi & Osservabilità, Media & Drive, Sensori, **Ecosistema con RandCore Health e Repo Radar** e **Configurazione 360°**.

Il motore `src/randai/control-center/` resta una proiezione read-only e non sostituisce store, RLS/RPC, audit, Sentry, Supervisor o Action Gateway.

WhatsApp attuale:
- Hotel Giò: `+390759978247`.
- Chocohotel: `+390759970610`.
- Brigantino: nessun numero configurato.

## RandApp

Funzioni principali: segnalazioni, interventi, Planning Lavori/Sale, housekeeping/rifornimenti, notifiche, meteo, sensori, impianti, Magazzino, offline/outbox e shell responsive.

Hotel Giò: Jazz usa camere a 4 cifre (`1101`, `1114`); Wine usa camere a 3 cifre (`201`, `214`).

### UI

RandApp è **mobile-first**. `src/randapp/Shell.jsx` è la sola sorgente del chrome autenticato: header, bottom navigation, drawer mobile, sidebar desktop e hotel switch. Le schermate non devono costruire navbar parallele.

Requisiti: iOS safe-area, `100dvh`, touch target almeno 44×44, System/Light/Dark, nessun overflow orizzontale sui viewport supportati. Il futuro RandControl può essere desktop-first responsive, ma usa lo stesso sistema RandUI e non un secondo design system.

## Multi-hotel

ID canonici:
- `hotelgio`
- `chocohotel`
- `brigantino`

Ogni record operativo deve mantenere il proprio `hotel_id`. L'isolamento è verificato tramite membership, RLS, permission, vincoli relazionali, test cross-hotel e mantenimento dello scope anche nella offline queue.

## Offline e notifiche

Dexie gestisce cache/outbox; nessun reset distruttivo automatico. Le operazioni modificabili usano identità stabile, lease, bounded retry, conflict protection e riconciliazione.

Canali notifiche: inbox RandApp + web/PWA push + ntfy parallelo per hotel/ruolo quando configurato.

## Osservabilità

Diagnostica interna + Sentry/OpenTelemetry opzionali. I secret devono essere redatti. Costi e metriche sono mostrati come reali solo quando misurati; niente stime presentate come telemetria effettiva.

## Quality gates

Prima di chiudere una modifica critica devono risultare verdi:

```bash
npm ci
npm audit --audit-level=high
npm run test:matrix
npm run test:critical
npm run test:multihotel
npm run test:production
npm run test:repo-radar
npm run test:core-health
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
```

La CI esegue dependency audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, production confidence, build, bundle budget, contratti RandAI/RandApp/shared, browser Chromium/WebKit e device acceptance. Repo Radar ha il proprio test deterministico e scouting GitHub settimanale. RandCore aggiunge un audit mensile separato; errori o telemetria mancante vengono registrati come finding/UNKNOWN, non trasformati in permesso o stato sano.

**Regola di chiusura:** un blocco è ✅ solo con implementazione canonica, isolamento multi-hotel, test dedicati, contratti condivisi verdi, zombie scan, README coerente, migration necessarie applicate e verificate, CI completa verde e merge finale senza forzare `main`.

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/core/` — contratti core, orchestrazione, Ecosystem Truth, Configuration e Health Snapshot.
- `src/randai/control/` — UI amministrativa RandAI/Control Center.
- `src/randai/control-center/` — motore/proiezione read-only canonica.
- `src/randai/` — knowledge, memory, agents, evals, recovery, learning, discovery, supervisor e domini RandAI.
- `src/reliability/` — reliability/safety condivisa 27+.
- `supabase/functions/` — boundary server.
- `supabase/migrations/` — schema, RLS/RPC e migrazioni versionate.
- `test/` e `scripts/` — contratti, quality gates, E2E e device acceptance.

## Consolidamento storico

- PR #118 — Blocco 1.
- PR #123 — consolidamento 1–16; #120/#121/#122 superseded.
- PR #124 — 17–20.
- PR #125 — 21–24.
- PR #126 — 25–26 e chiusura roadmap originale.
- PR #127 — 27–30.
- PR #129 — 31–34.
- PR #130 — 35–38.
- PR #131 — 39–42.
- PR #132 — 43–46.
- PR #133 — 47–50.
- PR #150 — 51–54 / Ecosystem Truth, RandCore, RandControl 360° e Configuration 360°.
- PR #152 — 55–58 / Repo Radar 2.0, Deep Repository Intelligence, Safe Adoption e integrazione RandControl.
- Blocco 15 / 59–62 — RandCore Health Snapshot, monthly full check, findings/history/drift e RandControl Health Console.

## Deploy

Il repository storico resta `Apicehotel/Apicehotel-Manutenzione`; il prodotto è RandApp/RandAI. Il progetto Vercel attivo documentato è `apicehotel-manutenzionr`.

Non usare nomi storici del repository come motivo per duplicare l'architettura applicativa.
