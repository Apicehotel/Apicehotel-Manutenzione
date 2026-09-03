# RandApp - Manutenzione

PWA React/Vite multi-hotel per Hotel Giò, Chocohotel e Hotel Il Brigantino. Supabase/RandApp restano il system of record; separazione dati tramite `hotel_id`, membership, RLS/RPC e test cross-hotel. Target: iOS/iPadOS, Android e Windows.

## Principi architetturali

- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun modello riceve `service_role`, PIN, refresh token o secret non necessari.
- Le scritture operative passano da tool/Action Gateway controllati.
- Output AI, telemetria, memoria e risultati tecnici non diventano verità operativa senza verifica.
- Nessun widening implicito: globale significa esplicitamente globale.
- Niente implementazioni parallele per la stessa responsabilità.
- Una parte viene eliminata come zombie solo se inutilizzata, irraggiungibile o sostituita da una sorgente canonica migliore.
- **Se esiste una soluzione nettamente migliore, si sostituisce la debolezza invece di accumulare patch.**

## RandAI — roadmap originale 1–26 ✅

### Blocco 1 — Fondazione Core — 1–4 ✅
1. Core / Orchestrator — lifecycle terminale esplicito.
2. Tool Registry — capability, rischio, timeout, retry e health check validati.
3. Skill Engine — `DRAFT → CANDIDATE → TESTED → APPROVED`.
4. Directive Composer — testo/evidenze preservati e approvazione esplicita.

### Blocco 2 — Motore operativo — 5–8 ✅
5. Maintenance Knowledge Engine — conoscenza e revisioni hotel-scoped.
6. Procedure Assistant — proposte DRAFT con evidenze e scope.
7. Planner → Executor → Verifier — nessun successo senza verifica.
8. Durable Tasks — checkpoint, lease, idempotenza, resume e riconciliazione.

### Blocco 3 — Memoria, contesto e routing — 9–12 ✅
9. Scoped Memory Engine — scope hotel/progetto/task/global esplicito.
10. Authorized Context Engine — sole evidenze autorizzate, provenance e budget.
11. Model Router — provider-agnostic con privacy/context/fallback bounded.
12. Knowledge Gaps — ciò che manca viene registrato, non inventato.

### Blocco 4 — Intelligenza operativa — 13–16 ✅
13. Smart Maintenance Suggestions 2.0.
14. Guided Procedures 2.0.
15. Project Intelligence 2.0.
16. Observability 2.0.

### Blocco 5 — Valutazione e recovery — 17–20 ✅
17. Evaluation / Benchmark 2.0.
18. Multi-Agent 2.0.
19. Permission / Autonomy 2.0.
20. Recovery / Self-Correction 2.0.

### Blocco 6 — Engineering e Supervisor — 21–24 ✅
21. Software Engineering Agent 2.0.
22. Learning Engine 2.0 — apprendimento solo da esperienza verificata, auto-promozione massima `TESTED`.
23. Skill / Tool Discovery 2.0 — discovery/sandbox/evaluation senza installazione automatica.
24. RandAI Supervisor 2.0 — budget, quality gate, routing e anti-loop hotel-scoped.

### Blocco 7 — Proattività e Control Center — 25–26 ✅
25. Proactive RandAI 2.0 — segnali hotel-scoped o globali espliciti.
26. Control Center 2.0 — proiezione read-only, vista hotel o `allHotels:true` esplicita.

## Estensione Reliability / Production

### Blocco 8 — Operational Safety Foundation — 27–30 ✅
27. Operational Context Layer 2.0 — envelope operativo versionato e sanitizzato server-side.
28. Context & Scope Guard 2.0 — hotel/source/version/modulo/risorsa/actor/ownership fail-closed.
29. Unified Validation Layer 2.0 — motore condiviso + composizione di dominio.
30. Safe Write Engine / Action Gateway 2.0 — approval, idempotenza, version fence, read-back, verification e receipt/audit.

### Blocco 9 — Production Hardening — 31–34 ✅
31. Authorization & RLS Verification Matrix — verifica l'autorità server senza duplicarla nel client.
32. Audit & Reversible Operations — compensazioni autorizzate, conflict-checked, read-back verified e auditate.
33. Offline / Retry / Concurrency Hardening — lease/backoff, idempotenza hotel-scoped, revision fence e riconciliazione prima del retry.
34. Import Safety Pipeline — `normalize → scope → validate → dedupe → stage → commit → read-back → verify → audit`.

### Blocco 10 — Verification, Trust, Hybrid Knowledge & Risk — 35–38 ✅
35. Verification Gate 2.0 — verifica multi-check hotel-scoped con `PASS/REVIEW/BLOCK`.
36. Evidence & Knowledge Trust — tier, freschezza e corroborazione; cross-hotel fail-closed.
37. Hybrid Memory + Knowledge Graph Production — composizione read-only sopra Memory Engine e Project Graph canonici.
38. Operational Confidence & Risk Engine — confidence deterministica ridotta dal rischio; critical/high-risk mai AUTO.

### Blocco 11 — Execution Resilience & Failure Intelligence — 39–42 ✅
39. **Plan Validator 2.0** — compone il `validatePlan()` canonico del runtime e aggiunge readiness operativa: tool realmente disponibili, permission, prerequisiti, rischio e hotel scope prima dell'esecuzione.
40. **Action Gateway 3.0 / Execution Policy** — il Gateway esistente resta il boundary canonico. Il nuovo percorso `executeGovernedRandAIAction()` richiede plan valido, permission e disposition del Confidence/Risk Engine; `REVIEW` richiede approval esplicita e `BLOCK` non può essere aggirato dall'approval.
41. **Recovery Budgets & Circuit Breakers** — budget separati per tentativi, tempo e costo; circuit breaker `CLOSED → OPEN → HALF_OPEN → CLOSED`, una sola probe half-open e nessun retry quando budget o circuito lo vietano.
42. **Failure Intelligence & Root Cause Engine** — fingerprint hotel-scoped per component/operation/resource/code, classificazione root cause deterministica, ricorrenze e ranking delle recovery sulla base dei successi reali, senza sostituire Observability.

### Blocco 12 — Production Confidence & Safe Rollout — 43–46 ✅
43. **Adversarial Reliability Testing** — scenari deterministici hotel-scoped che provano timeout, scope errato, failure e condizioni avverse; una suite non verde blocca il gate.
44. **Fault Injection & Chaos Safety** — fault riproducibili `THROW_BEFORE`, `THROW_AFTER`, error return e sequenze scriptate. Verifica reale di write-then-timeout, riconciliazione, lease e circuit breaker senza chaos casuale/flaky.
45. **Production Release Gate** — check obbligatori security/quality/critical/multi-hotel/build/contracts/browser/device/adversarial più soglie su failure, verification failure e rollback rate. Una regressione blocca la release.
46. **Canary / Safe Rollout & Automatic Rollback** — rollout deterministico per hotel/modulo/attore, percentuale controllata, pause/resume e rollback automatico quando failure o verification failure superano le soglie.

Sorgenti Blocco 12: `src/reliability/fault-injection.js`, `adversarial-suite.js`, `release-gate.js`, `rollout-controller.js`. Test dedicato: `test/randai-block12-production-43-46.test.js`. La CI espone `npm run test:production` come gate esplicito, non duplicato nel loop contratti RandAI.

Zombie scan Blocco 12: i test e i gate esistenti restano canonici; fault injection li esercita invece di sostituirli. RecoveryCircuit, offline reconciliation, CI quality/critical/multi-hotel e browser/device restano sorgenti di verità. Nessun framework chaos, secondo runner CI o secondo sistema di deploy è stato introdotto.

### Blocco 12 bis — Runtime Governance & Release Evidence — 47–50 ✅
47. **Runtime Capability Fuse / Emergency Stop** — kill switch esplicito e hotel/module/capability-scoped. `TRIPPED` blocca immediatamente la capability interessata e il reset richiede autorizzazione esplicita; nessun widening globale implicito.
48. **Configuration & Policy Drift Guard** — snapshot canonico deterministico di hotel/modulo/versione/policy/config e fingerprint; mismatch di scope, versione o configurazione fallisce chiuso prima dell'esecuzione.
49. **SLO & Error Budget Guard** — calcolo deterministico di bad-event rate e burn rate rispetto al target SLO; error budget esaurito produce `SLO_ERROR_BUDGET_EXHAUSTED` e impedisce di trattare una release degradata come sana.
50. **Release Attestation / Evidence Binding** — attestazione strutturata che lega release, commit, config fingerprint, check obbligatori ed evidenze CI. Il formato è ispirato ai principi di provenance/attestation (es. SLSA) ma non dichiara conformità SLSA né sostituisce firme crittografiche della piattaforma.

Sorgenti Blocco 12 bis: `src/reliability/runtime-fuse.js`, `drift-guard.js`, `slo-budget.js`, `release-attestation.js`. Test dedicato: `test/randai-block12bis-production-47-50.test.js`. `npm run test:production` esegue insieme 43–46 e 47–50: un solo gate di produzione, nessun runner parallelo.

Zombie scan Blocco 12 bis: `release-gate.js`, `rollout-controller.js`, `recovery-circuit.js`, offline reconciliation e CI del Blocco 12 restano canonici. 47–50 coprono esclusivamente arresto runtime, drift, SLO/error budget e binding delle evidenze di release; nessun secondo rollout controller, secondo release gate o feature-flag framework è stato introdotto.

## Runtime Safety Layer — trasversale

- Identity/Auth server-side per `/randai`.
- Hotel isolation esplicita in conoscenza, memoria, context, guidance, gap, approval, recovery, learning, supervisor, proactive, Control Center e write.
- RLS/RPC Supabase restano autorità server.
- Safe write con approval + idempotenza + optimistic version fence + read-back + audit.
- Plan readiness: un piano sintatticamente valido non è automaticamente eseguibile; tool/permission/prerequisiti/scope devono essere verificati.
- Execution policy: `AUTO/REVIEW/BLOCK` del Confidence/Risk Engine governa il nuovo percorso Action Gateway 3.0.
- Offline/concurrency: retry solo dopo riconciliazione; niente promessa fittizia di exactly-once.
- Recovery: tentativi, tempo e costo sono bounded; circuit breaker ferma failure storm e consente probe controllate.
- Failure intelligence: errori e recovery sono aggregati per hotel; un successo in Giò non insegna automaticamente una recovery a Chocohotel.
- Adversarial/fault injection: failure-mode riproducibili e deterministici, senza rendere flaky la CI.
- Release/rollout: una release non è pronta solo perché compila; deve superare il production gate e può essere canary/rollbackata per scope.
- Runtime fuse: una capability può essere fermata per hotel/modulo senza spegnere tutto RandAI; reset solo autorizzato.
- Drift/SLO: configurazione inattesa o error budget bruciato impediscono di considerare il runtime sano.
- Release evidence: commit, configurazione e check verdi restano legati in una attestazione verificabile a livello applicativo.
- Import safety: staging e verifica prima del commit.
- Verification/trust: successo tecnico, memoria o evidenza non equivalgono automaticamente a verità.
- Confidence/risk: l'autonomia è limitata da verifica, trust, completezza contesto e rischio.
- Telemetria non-fatal ed external discovery senza installazione automatica.

## Consolidamento storico

- PR #118 — Blocco 1.
- PR #123 — consolidamento 1–16; #120/#121/#122 chiuse come superseded.
- PR #124 — 17–20.
- PR #125 — 21–24.
- PR #126 — 25–26 e chiusura roadmap originale.
- PR #127 — 27–30.
- PR #129 — 31–34.
- PR #130 — 35–38, Verification/Trust/Hybrid Knowledge/Risk.
- PR #131 — 39–42, Execution Resilience/Recovery Budgets/Failure Intelligence.
- PR #132 — 43–46, Production Confidence/Adversarial/Fault Injection/Safe Rollout.
- PR #133 — 47–50, Blocco 12 bis Runtime Governance/Drift/SLO/Release Attestation.

## CI e regola di chiusura

La CI esegue dependency security audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, **Production confidence gate 43–50**, build, bundle budget, contratti RandAI, RandApp/shared, Chromium/WebKit, cross-platform browser e device acceptance.

Un blocco è ✅ solo con implementazione canonica, isolamento multi-hotel, test dedicati, contratti condivisi verdi, zombie scan, README coerente, CI completa verde e merge finale senza forzare `main`.

## Blocco 13 — Smart Maintenance Suggestions 2.0

Il motore dei suggerimenti è condiviso e hotel-scoped. Non sostituisce la conoscenza approvata, il Verification Gate o l'Action Gateway.

- Cerca più procedure pertinenti invece di fermarsi alla prima corrispondenza.
- Ordina procedure approvate/verificate ed esperienze precedenti con ranking deterministico.
- Ogni suggerimento espone provenienza, versione, rilevanza, confidenza, rischio, motivazioni e prossima azione.
- Le memorie storiche sono sempre non-actionable: vanno confrontate con i dati attuali e non applicate automaticamente.
- Le procedure non approvate non possono avviare la guida operativa.
- Deduplicazione per sorgente e limite massimo dei risultati per evitare suggerimenti ripetuti o zombie.
- Query vuote o non pertinenti producono nessun suggerimento: RandAI non inventa.

Sorgenti: src/randai/maintenance/suggestion-engine.js, decision-engine.js e test/randai-suggestion-engine.test.js.

## Blocco 14 — Guided Procedures 2.0

Il percorso guidato trasforma una procedura approvata in un lavoro tracciabile e riprendibile, mantenendo hotel scope e controllo umano.

- Avvio dalla procedura approvata suggerita da RandAI.
- Passaggi sequenziali con stato persistente in `randai_tasks`.
- Avanzamento solo tramite conferma umana e verifica registrata.
- Pausa/ripresa, checkpoint, revision fence e riepilogo finale.
- Diramazioni, ruoli richiesti e stop condition gestiti dal motore canonico `GuidedProcedureEngine`.
- Le segnalazioni restano separate per hotel; un task non può essere letto o avanzato fuori scope.
- Nessuna chiusura automatica della segnalazione: l’esito finale resta da confermare nell’operatività RandApp.

Sorgenti: `src/randai/guidance/`, `src/randai/issue-workspace.js` e `supabase/functions/randai-issue-workspace/index.ts`.

## RandAI Control Center / WhatsApp

Route protetta: `/randai`. Il motore `control-center/` è una proiezione read-only; UI/console non sostituiscono RLS/RPC/Action Gateway.

- Hotel Giò: `+390759978247`.
- Chocohotel: `+390759970610`.
- Brigantino: nessun numero configurato.

## RandApp

Funzioni principali: segnalazioni, interventi, Planning Lavori/Sale, housekeeping/rifornimenti, notifiche, meteo, sensori, impianti, Magazzino, offline/outbox e shell responsive.

Hotel Giò: Jazz usa camere a 4 cifre (`1101`, `1114`); Wine usa camere a 3 cifre (`201`, `214`).

## Struttura repository

- `src/randapp/` — shell/UI e domini RandApp.
- `src/randai/` — motori RandAI 1–26 e Action Gateway.
- `src/reliability/` — reliability/safety condivisa 27+.
- `supabase/functions/` — boundary server.
- `supabase/migrations/` — migrazioni.
- `test/` e `scripts/` — contratti, quality gates ed E2E.
