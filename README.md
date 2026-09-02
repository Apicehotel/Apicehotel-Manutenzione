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

Sorgenti principali: `src/randai/context/`, `src/reliability/context-scope-guard.js`, `validation-engine.js`, `domain-validation.js`, `safe-write-engine.js`, `src/randai/action-gateway.js`, `supabase/functions/randai-action-gateway/`.

### Blocco 9 — Production Hardening — 31–34 ✅
31. Authorization & RLS Verification Matrix — verifica l'autorità server senza duplicarla nel client.
32. Audit & Reversible Operations — compensazioni autorizzate, conflict-checked, read-back verified e auditate.
33. Offline / Retry / Concurrency Hardening — lease/backoff, idempotenza hotel-scoped, revision fence e riconciliazione prima del retry.
34. Import Safety Pipeline — `normalize → scope → validate → dedupe → stage → commit → read-back → verify → audit`; nessun commit parziale con righe invalide/cross-hotel.

Sorgenti principali: `src/reliability/authorization-matrix.js`, `audit-reversible.js`, `offline-concurrency.js`, `import-safety.js`.

### Blocco 10 — Verification, Trust, Hybrid Knowledge & Risk — 35–38 ✅
35. **Verification Gate 2.0** — verifica multi-check hotel-scoped; controlli duplicati o invalidi falliscono, serve almeno una verifica indipendente e il risultato è `PASS`, `REVIEW` o `BLOCK`.
36. **Evidence & Knowledge Trust** — trust deterministico da tier, freschezza e corroborazione multi-source; evidenza cross-hotel viene rifiutata.
37. **Hybrid Memory + Knowledge Graph Production** — composizione read-only sopra Scoped Memory Engine e Project Graph esistenti; filtra per hotel e trust, deduplica e non introduce un secondo store o graph database.
38. **Operational Confidence & Risk Engine** — confidence calcolata da verification + evidence trust + completezza contesto, poi ridotta dal rischio; azioni critical/high-risk non possono diventare AUTO.

Sorgenti Blocco 10: `src/reliability/verification-gate.js`, `evidence-trust.js`, `hybrid-memory-graph.js`, `confidence-risk.js`. Test dedicato: `test/randai-block10-reliability-35-38.test.js`.

Zombie scan Blocco 10: `src/randai/memory/` e `src/randai/projects/graph.js` restano canonici e vivi. Il nuovo layer li compone invece di copiarli. Nessuna dipendenza esterna o nuova migrazione viene aggiunta perché le primitive interne sono già più integrate e hanno superato i gate completi.

## Runtime Safety Layer — trasversale

- Identity/Auth server-side per `/randai`.
- Hotel isolation esplicita in conoscenza, memoria, context, guidance, gap, approval, recovery, learning, supervisor, proactive, Control Center e write.
- RLS/RPC Supabase restano autorità server.
- Safe write con approval + idempotenza + optimistic version fence + read-back + audit.
- Offline/concurrency: retry solo dopo riconciliazione; niente promessa fittizia di exactly-once.
- Import safety: staging e verifica prima del commit.
- Verification/trust: successo tecnico, memoria o evidenza non equivalgono automaticamente a verità.
- Confidence/risk: l'autonomia è limitata da verifica, trust, completezza contesto e rischio; critical/high-risk restano bloccate.
- Recovery bounded e telemetria non-fatal.
- External discovery non installa automaticamente.

## Consolidamento storico

- PR #118 — Blocco 1.
- PR #123 — consolidamento 1–16; #120/#121/#122 chiuse come superseded.
- PR #124 — 17–20.
- PR #125 — 21–24.
- PR #126 — 25–26 e chiusura roadmap originale.
- PR #127 — 27–30.
- PR #129 — 31–34.
- PR #130 — 35–38, Verification/Trust/Hybrid Knowledge/Risk.

## CI e regola di chiusura

La CI esegue dependency security audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, build, bundle budget, contratti RandAI, RandApp/shared, Chromium/WebKit, cross-platform browser e device acceptance.

Un blocco è ✅ solo con implementazione canonica, isolamento multi-hotel, test dedicati, contratti condivisi verdi, zombie scan, README coerente, CI completa verde e merge finale senza forzare `main`.

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
