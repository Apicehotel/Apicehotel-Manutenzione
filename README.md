# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target supportati e testati: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato attuale

RandApp è l'app operativa. RandAI è l'assistente e control layer integrato; RandMind, RandBrain, RandUI, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dell'ecosistema, non applicazioni parallele.

La regola architetturale resta: **un solo proprietario canonico per capacità**. Se una soluzione è nettamente migliore, più semplice e più sicura, sostituisce quella debole invece di accumulare patch o creare un secondo sistema.

## Confini architetturali

- `hotel_id`, membership e scope hotel sono obbligatori.
- Supabase RLS/RPC è l'autorità finale; nascondere una funzione nella UI non concede né revoca permessi.
- RandAI riceve soltanto contesto autorizzato e hotel-scoped.
- Nessun modello/frontend riceve `service_role`, PIN, refresh token o secret non necessari.
- Mutazioni protette passano da Safe Write / Action Gateway / audit.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Niente secondi sistemi per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario, discovery o rollback.
- Una parte viene eliminata come zombie soltanto dopo verifica di utilizzo, riferimenti e dipendenze.

## RandRadar Full Evolution v1

`RAND_FULL_EVOLUTION_V1` rende Repo Radar un motore di scouting dell'intero prodotto, non un radar limitato a categorie statiche. Il perimetro deriva dalle 24/24 pagine RandApp, dai moduli governati dell'ecosistema e dai 14 fronti evolutivi RandAI. Discovery: GitHub, GitLab, Codeberg e npm. Stelle/popolarità sono segnali deboli; adozione richiede licenza, manutenzione, sicurezza, compatibilità, benchmark e rollback. **Nessuna discovery auto-installa o auto-sostituisce codice.**

Comando: `npm run repo:radar`. Workflow: `.github/workflows/repo-radar.yml`. Dettaglio: `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md`.

## RandSkills

RandSkills introduce competenze modulari/versionate senza creare un secondo sistema di autorizzazione. Skill canoniche: `maintenance`, `housekeeping`, `planning`, `warehouse`, `whatsapp`, `procedures`, `repo-radar`.

`objective → RandSkillRouter → skill APPROVED → permission/tool requirements → autorizzazioni caller → risk bound → RandAgentRuntime`

Il router può restringere capacità, mai concederle. Comandi: `npm run skills:validate`, `npm run test:randskills`, `npm run test:randskills:governance`.

## RandMind / RandBrain / RandAI

RandMind è la memoria canonica governata con provenienza, temporalità, conflitti, retention e forgetting auditabile. RandBrain governa routing, reasoning graph, autonomia e learning verificato. RandMind può imparare da esiti verificati, ma non può cambiare da solo i confini critici di RandCore.

## RandCore e Security Intelligence

RandCore governa health, audit, release gate, workers, sicurezza, costi, integrazioni ed evidenze LTS. `Exploitarium` resta fonte `SECURITY_INTELLIGENCE`; `reverse-skill` resta donatore `ANALYSIS_PATTERN` sandbox-only.

## RandAI Group 1 — Guardrails e observability

- RandTool Gateway fail-closed su tool, caller, hotel e scope.
- Promptfoo è regression/evaluation gate CI, fuori dal bundle runtime.
- OpenTelemetry resta il contratto canonico; Phoenix è backend OTLP opzionale.
- ToolHive resta adapter MCP opzionale dietro RandTool Gateway.

Comandi: `npm run test:group1`, `npm run eval:randai:security`. Workflow: `.github/workflows/randai-group1-security.yml`. Dettaglio: `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md`.

## RandAI Group 2 — Knowledge, memoria e RAG

- Supabase/Postgres resta source of truth operativa e RLS/RPC autorità finale.
- RandMind resta memoria canonica.
- Graphiti è projection temporale/bi-temporale opzionale e ricostruibile.
- LightRAG è projection retrieval documentale/ibrida opzionale e ricostruibile.
- RandKnowledge Gateway applica identità, hotel, `knowledge:read`, provenienza e validità temporale.

Comando: `npm run test:group2`. Workflow: `.github/workflows/randai-group2-knowledge.yml`. Dettaglio: `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md`.

## RandAI Group 3 — Durable runtime

Il Gruppo 3 introduce `RandDurableRuntime` come contratto canonico di lifecycle per workflow lunghi senza importare un secondo orchestratore nel PWA.

- avvio fail-closed con identità, hotel e `workflow:execute`;
- idempotency key obbligatoria contro doppie esecuzioni;
- checkpoint/resume e cancellazione deterministici;
- ogni resume rivalida autorizzazione e può ricaricare conoscenza fresca;
- `workflowId` + `workflowVersion` impediscono resume incompatibili;
- retry solo espliciti e bounded da `maxAttempts`;
- tracing riusa OpenTelemetry del Gruppo 1;
- il recovery engine esistente resta proprietario di budget/circuit/recovery locale e non viene duplicato;
- Trigger.dev resta candidato executor server-side per job lunghi/costosi, Mastra motore agentico opzionale e LangGraph reference: nessuno acquisisce ownership RandCore.

`InMemoryDurableStore` serve come adapter di contratto/test; la persistenza produttiva deve restare server-side dietro lo stesso contratto.

Comando: `npm run test:group3`. Workflow: `.github/workflows/randai-group3-durable.yml`. Dettaglio: `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md`.

Flusso consolidato:

`RandBrain → RandSkills → RandKnowledge Gateway → RandTool Gateway → RandDurableRuntime → Safe Write/RLS → audit/telemetry`

## RandUI

RandUI è il design system canonico: `Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell`. Il catalogo copre 24/24 destinazioni correnti e usa 14 template ufficiali, con guard fail-closed responsive/accessibilità.

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, manutenzioni, magazzino, urgenze, promemoria, sensori/temperature, utenti/ruoli, guide, feedback, desktop e RandAI. Warehouse resta bounded domain; Rifornimenti resta workflow operativo separato. RandChat riusa identità/autorizzazioni RandApp.

## Safe-area e target device

Il contratto responsive usa `viewport-fit=cover`, `env(safe-area-inset-*)`, `src/randapp/system-insets.js` e `adaptive-layout.css`; header e contenuto condividono il gutter canonico.

## Quality Matrix e test

```bash
npm run build
npm test
npm run test:quality
npm run test:group1
npm run test:group2
npm run test:group3
npm run eval:randai:security
npm run test:repo-radar
npm run test:randskills
npm run test:mind-learning
npm run test:security-intelligence
npm run test:randui
npm run test:e2e
npm run test:device
npm run test:lts
```

La CI certifica dependency/security audit, Quality Matrix, critical operational gate, multi-hotel parity, production confidence, build/bundle budget, contratti RandBrain/RandUI/RandAudio/Viking/RandAI/RandApp, Chromium + WebKit, device acceptance, RandCore health evidence e Rand Ecosystem LTS. I workflow Group 1/2/3 aggiungono rispettivamente tool authorization/evaluation, knowledge provenance/temporal boundary e durable lifecycle/resume.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`. Produzione stabile: Vercel. Durante l'unificazione RandUI v1 i Git deploy Vercel restano congelati (`deploymentEnabled: false`); prove/deploy nuova UI vanno su DigitalOcean/Ocean finché non viene decisa esplicitamente la riattivazione.

## Documentazione

- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md`
- `docs/architecture/RANDSKILLS_V1.md`
- `docs/architecture/RANDSKILLS_ROUTER_BLOCK1.md`
- `docs/architecture/RANDSKILLS_GOVERNANCE_BLOCK2.md`
- `docs/architecture/RANDMIND_LEARNING_BLOCK2.md`
- `docs/architecture/RANDCORE_SECURITY_INTELLIGENCE_BLOCK3.md`
- `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md`
- `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md`
- `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md`
- `docs/architecture/RANDUI_V1_CORE.md`
- `docs/architecture/RANDUI_V1_GUARD.md`
- `docs/architecture/RANDUI_V1_MIGRATION.md`
- `docs/architecture/RANDUI_VISUAL_LANGUAGE_V1.md`
- `docs/architecture/RANDUI_TELEGRAM_NAVIGATION_V1.md`
- `docs/architecture/RANDCHAT.md`
- `docs/architecture/RANDDESKTOP_PRINTING.md`
- `docs/architecture/RIFORNIMENTI_INTERNI.md`
- `docs/README-history-2026-09-05.md`

Questo README rappresenta lo **stato corrente**; dettagli storici e specialistici vivono nei documenti dedicati.
