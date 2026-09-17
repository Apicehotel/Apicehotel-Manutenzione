# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA interna React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target verificati dalla Quality Matrix: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato consolidato — 17 settembre 2026

RandUI rebuild v1 è chiuso e integrato. La shell, la navigazione adattiva, i contratti responsive e le 24 destinazioni RandUI hanno un proprietario unico. RandApp è l'app operativa; RandAI è l'assistente e control layer integrato. RandMind, RandResearch, RandBrain, RandUI, RandDesignBridge, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dello stesso ecosistema, non applicazioni parallele.

Principio permanente: **un solo proprietario canonico per capacità**. Se una soluzione è realmente migliore, più semplice e più sicura, sostituisce quella debole; non accumuliamo framework, patch o sistemi duplicati.

## Stack canonico

- React 19 + Vite 7 per la PWA.
- Supabase/Postgres per dati, Auth, RLS/RPC, Realtime e source of truth operativa.
- RandUI come design system unico.
- RandGateway come unico ingresso governato per Web/RandApp, RandChat, MCP e WhatsApp/Twilio.
- RandCore per health, audit, release gate, workers, sicurezza, costi, governance e integrazioni.
- RandMind come memoria governata canonica; RandResearch come owner della ricerca evidence-first.
- DigitalOcean/Ocean per preview e workload esterni/pesanti; Vercel resta la produzione stabile.
- Node: `.nvmrc` fissa `24.20.0`; `package.json` usa `24.x` per compatibilità buildpack Ocean.

## Confini invariabili

- `hotel_id`, membership e scope hotel sono obbligatori.
- Supabase RLS/RPC è l'autorità finale: nascondere una funzione nella UI non concede permessi.
- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun frontend/modello riceve `service_role`, PIN, refresh token o secret non necessari.
- Mutazioni protette passano da Safe Write / Tool Gateway / RandSecure-HITL / Action Gateway / audit.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Nessun secondo sistema per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario, discovery o rollback.
- Una parte è zombie soltanto dopo verifica di utilizzo, riferimenti e dipendenze.
- Nessun agente può pushare, mergiare o deployare direttamente `main`: branch + PR + CI + **revisione umana**.

## RandSpec + RandFlow

RandSpec estende RandFlow senza creare un secondo lifecycle:

`DISCOVER → SPECIFY → PLAN → RANDRADAR → TASKS → IMPLEMENT → TEST → SECURITY → CONVERGE → READY_FOR_HUMAN_MERGE`

Ogni modifica sostanziale usa `specs/<id-slug>/{spec.md,plan.md,tasks.md,change-log.md}`. La Constitution vive in `docs/governance/RAND_CONSTITUTION.md`. Spec Kit resta `SOURCE_ONLY/ADAPT`, non runtime.

```bash
npm run spec:validate
npm run test:randspec
```

## RandUI

Flusso canonico:

`Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell`

Il catalogo copre **24/24 destinazioni** con 14 template. RandUI Guard è fail-closed su composizione, overflow, viewport, touch target, accessibilità e ID DOM. La matrice responsive copre 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px, Chromium e WebKit.

La standardizzazione RandUI mantiene `RANDUI_VERSION=1.0.0` e governa separatamente token portabili, motion con reduced-motion fail-safe e adapter semantico delle icone. `src/randapp/randui-v2/` non è zombie finché `/ui-v2-preview` è usata dal gate Ocean.

## RandAI, RandMind e RandResearch

Le superfici RandAI restano due: **Quick Assistant** dentro RandApp e **Control Center `/randai`** protetto e multi-hotel.

- **Group 1**: RandTool Gateway, Promptfoo, OpenTelemetry e ToolHive opzionale dietro i gate.
- **Group 2**: Supabase source of truth, RandMind memoria canonica, projection opzionali ricostruibili e RandKnowledge Gateway.
- **Group 3**: RandDurableRuntime per checkpoint/resume/cancel/idempotenza e RandCore Runtime v2 per eventi, job lifecycle, retry/dead-letter, heartbeat e snapshot operativo.
- **Group 4**: governance runtime, audit/rules/doctor/security decision layer.
- **Group 5 / RandMind v2**: memoria VERIFIED solo da evidenza auditata, temporal recall `recallAt`, conflitti/supersession e retention non distruttiva.
- **Group 6 / RandResearch**: ricerca L0–L4, provenance, source scoring, contradiction/gap detection e ship gate fail-closed.
- **Group 7 / HITL**: risk policy canonica, approvazione umana per azioni protette e sandbox senza unrestricted host execution.

RandMind può apprendere da esiti verificati ma non può cambiare autonomamente i confini critici di RandCore.

## RandGateway

`adapter → RandGateway → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Gli adapter Web, RandChat, MCP e Twilio/WhatsApp producono envelope canonici ma non decidono identità, hotel, ruolo, rischio o permessi. Nessun adapter può scrivere direttamente dati operativi.

## RandRadar Full Evolution

Repo Radar deriva il perimetro dalle 24 pagine RandApp, dai moduli governati e dai fronti evolutivi RandAI. Il discovery automatico usa GitHub, GitLab, Codeberg, Gitee, npm, crates.io, Hugging Face e Open VSX; la policy manuale copre anche marketplace, registri MCP, Figma Community, Storybook e altre fonti pertinenti.

Classificazione: **Aggiungi / Sostituisci / Ignora / Fonte**; runtime interno `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`. Nessuna discovery auto-installa codice.

```bash
npm run repo:radar
```

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, warehouse, urgenze, promemoria, sensori/temperature, utenti/ruoli, RandGuide, feedback, RandChat, RandDesktop e RandAI.

Warehouse mantiene ledger/stock/seriali e integrazione con Interventi. Rifornimenti resta un workflow distinto e non crea quantità o movimenti Warehouse. RandChat riusa identità e autorizzazioni RandApp; DM E2EE e media mantengono i rispettivi boundary. RandDesktop riusa RandApp e aggiunge solo capacità native ristrette.

## Offline e device

RandApp usa un solo stack offline: Service Worker + sessione locale controllata + Dexie/IndexedDB. Safe-area e responsive usano `viewport-fit=cover`, `env(safe-area-inset-*)`, `system-insets.js` e layout adattivo. Header e contenuto condividono il gutter canonico e la safe-area superiore ha un solo proprietario.

## Quality Matrix e test

```bash
npm run build
npm test
npm run test:quality
npm run test:phase0
npm run test:phase1
npm run test:group1
npm run test:group2
npm run test:group3
npm run test:group4
npm run test:group5
npm run test:group6
npm run test:randui
npm run test:e2e
npm run test:device
npm run test:lts
npm run skills:validate
npm run spec:validate
npm run repo:radar
npm run design:check
npm run release:check
```

La CI canonica verifica RandSpec, dependency/security audit, Phase 0/1, Quality Matrix, critical operational gate, multi-hotel parity, production confidence, build/bundle budget, contratti RandApp/RandAI/RandUI/RandBrain/RandAudio, Chromium + WebKit, device acceptance, RandCore health evidence e LTS attestation.

Android richiede inoltre pacchetto firmato e prova su dispositivo reale: `npm run release:check:android` è fail-closed se queste evidenze esterne mancano.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

- **Produzione stabile:** Vercel.
- **Preview/test grafici:** DigitalOcean/Ocean.
- Gli agenti non promuovono automaticamente branch in produzione.
- `/ui-v2-preview` resta una superficie di verifica finché il workflow Ocean la usa.

## Documentazione principale

- `docs/governance/RAND_CONSTITUTION.md` — ownership, freeze, HITL e change protocol.
- `docs/architecture/RANDSPEC_V1.md` — specifiche governate e convergenza.
- `docs/architecture/RANDCORE_RUNTIME_V2.md` — runtime core, eventi e health.
- `docs/architecture/RAND_GOVERNANCE_V1.md` — governance runtime.
- `docs/architecture/RANDMIND_V2.md` — memoria verificata e temporal governance.
- `docs/architecture/RANDRESEARCH_V1.md` — deep research evidence-first.
- `docs/architecture/RANDAI_RUNTIME_HITL_V1.md` — HITL, risk policy e sandbox.
- `docs/architecture/RANDUI_STANDARDIZATION_V1.md` — token, motion e icone.
- `docs/architecture/RANDAI_UI_FOUNDATION_V1.md` — ownership UI RandAI.
- `docs/architecture/RANDGATEWAY_POINT7.md` — gateway, adapter, HITL e audit.
- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` e `docs/RAND_RADAR_POLICY.md` — discovery multisorgente e governance.
- `docs/architecture/RANDDESIGNBRIDGE_V1.md` — Figma ↔ RandUI e visual gate.
- `docs/architecture/RANDCHAT.md` — gruppi, DM E2EE e media.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — desktop/stampa.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — rifornimenti.

Questo README descrive lo **stato operativo corrente**. Cronologia e dettagli specialistici restano nei documenti dedicati per evitare documentazione zombie.
