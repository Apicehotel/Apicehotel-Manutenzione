# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA interna React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target verificati dalla Quality Matrix: iOS/iPadOS, Android, tablet e Windows/desktop.

## Stato consolidato — 17 settembre 2026

**RandUI rebuild v1 è chiuso e integrato in `main` tramite PR #267.** L'ultimo candidato ha superato CI canonica, browser/device gate, RandAI Group 1/2/3, RandDesignBridge e preview Ocean. La shell, la navigazione adattiva, i contratti responsive e le 24 destinazioni RandUI hanno ora un proprietario unico.

RandApp è l'app operativa. RandAI è l'assistente e control layer integrato; RandMind, RandBrain, RandUI, RandDesignBridge, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dello stesso ecosistema, non applicazioni parallele.

Principio permanente: **un solo proprietario canonico per capacità**. Se una soluzione è realmente migliore, più semplice e più sicura, sostituisce quella debole; non accumuliamo framework, patch o sistemi duplicati.

### Blocco attivo

Il blocco successivo è **RandAI UI Foundation v1**: popup rapido e Control Center completo restano separati, ma condividono il linguaggio RandUI. Vercel AI Elements, Crafter Elements, Fantastic Admin e i template Flutter valutati da RandRadar sono fonti di pattern/riferimento; non vengono installati come secondo design system nello stack React/Vite attuale.

Dettaglio: `docs/architecture/RANDAI_UI_FOUNDATION_V1.md`.

## Stack canonico

- React 19 + Vite 7 per la PWA.
- Supabase/Postgres per dati, Auth, RLS/RPC, Realtime e source of truth operativa.
- RandUI come design system unico.
- RandGateway come unico ingresso governato per azioni da Web/RandApp, RandChat, MCP e WhatsApp/Twilio.
- RandCore per health, audit, release gate, workers, sicurezza, costi e integrazioni.
- DigitalOcean/Ocean per preview e workload esterni/pesanti; Vercel resta la produzione stabile.
- Node: `.nvmrc` fissa `24.20.0` per sviluppo/CI; `package.json` usa `24.x` per compatibilità buildpack Ocean.

## Confini invariabili

- `hotel_id`, membership e scope hotel sono obbligatori.
- Supabase RLS/RPC è l'autorità finale: nascondere una funzione nella UI non concede permessi.
- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun frontend/modello riceve `service_role`, PIN, refresh token o secret non necessari.
- Mutazioni protette passano da Safe Write / Tool Gateway / RandSecure-HITL / Action Gateway / audit.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Nessun secondo sistema per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario, discovery o rollback.
- Una parte è zombie soltanto dopo verifica di utilizzo, riferimenti e dipendenze.
- Nessun agente può pushare/mergiare/deployare direttamente `main`: branch + PR + CI + revisione umana.

## RandUI

Flusso canonico:

`Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell`

Il catalogo copre **24/24 destinazioni** con 14 template. RandUI Guard è fail-closed su composizione, overflow, viewport, touch target, accessibilità e ID DOM. La matrice responsive copre 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px, Chromium e WebKit.

La navigazione mobile conserva Home come ancora centrale e RandAI come ancora finale; la bottom navigation naviga soltanto, mentre il `+` crea esclusivamente l'oggetto del contesto attivo.

`src/randapp/randui-v2/` **non è zombie** finché `/ui-v2-preview` è ancora usata dal gate Ocean. Verrà eliminata solo quando quel gate sarà sostituito e non resteranno referenze runtime/CI.

## RandAI

Le superfici restano intenzionalmente due:

- **Quick Assistant**: popup contestuale autenticato dentro RandApp.
- **Control Center `/randai`**: pagina completa protetta, amministrativa e multi-hotel.

La UI Foundation v1 definisce otto primitive AI native e dependency-free: `conversation`, `message`, `source`, `status`, `reasoning`, `plan`, `tool`, `composer`. Queste primitive sono UI: non concedono permessi e non bypassano RandGateway.

### RandRadar — fonti UI recenti

| Fonte | Decisione |
| --- | --- |
| `vercel/ai-elements` | `ADOPT_PATTERN` |
| `crafter-station/elements` | `SOURCE_ONLY` |
| `fantastic-admin/basic` | `LAYOUT_REFERENCE` |
| `abuanwar072/E-commerce-Complete-Flutter-UI` | `MOBILE_REFERENCE` |

Regola: **RandUI esistente → adattamento pattern esterno → componente nativo nuovo**. Una nuova dipendenza entra solo se riduce davvero complessità e supera Quality Matrix, security review e rollback review.

## RandAI runtime e knowledge

- **Group 1**: RandTool Gateway, Promptfoo, OpenTelemetry e ToolHive opzionale dietro i gate.
- **Group 2**: Supabase source of truth, RandMind memoria canonica, Graphiti/LightRAG soltanto projection opzionali ricostruibili, RandKnowledge Gateway per provenance e temporal scope.
- **Group 3**: RandDurableRuntime per checkpoint/resume/cancel/idempotenza, con re-authorization a ogni resume.
- RandBrain governa model routing, reasoning graph, autonomia e learning verificato.
- RandMind può apprendere da esiti verificati ma non può cambiare i confini critici di RandCore.

## RandGateway

Flusso operativo:

`adapter → RandGateway → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Gli adapter Web, RandChat, MCP e Twilio/WhatsApp producono envelope canonici ma non decidono identità, hotel, ruolo, rischio o permessi. Nessun adapter può scrivere direttamente dati operativi.

## RandRadar Full Evolution

Repo Radar deriva il perimetro dalle 24 pagine RandApp, dai moduli governati dell'ecosistema e dai fronti evolutivi RandAI. Il discovery automatico usa GitHub, GitLab, Codeberg, Gitee, npm, crates.io, Hugging Face e Open VSX; la policy manuale copre anche marketplace, registri MCP, Figma Community, Storybook e altre fonti pertinenti.

Classificazione: **Aggiungi / Sostituisci / Ignora / Fonte**; runtime interno `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`.

Nessuna discovery auto-installa codice. Ogni adozione richiede manutenzione, sicurezza, compatibilità, licenza, benchmark, rollback e ownership chiaro.

```bash
npm run repo:radar
```

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, warehouse, urgenze, promemoria, sensori/temperature, utenti/ruoli, RandGuide, feedback, RandChat, RandDesktop e RandAI.

Warehouse mantiene ledger/stock/seriali e integrazione con Interventi. Rifornimenti resta un workflow distinto e non crea quantità o movimenti Warehouse. RandChat riusa identità e autorizzazioni RandApp; DM E2EE e media mantengono i rispettivi boundary. RandDesktop riusa RandApp e aggiunge solo capacità native ristrette.

## Offline e device

RandApp usa un solo stack offline: Service Worker + sessione locale controllata + Dexie/IndexedDB. L'ultimo accesso validato può essere riutilizzato offline entro il limite definito dalla policy; al ritorno della rete Supabase/RandCore tornano autoritativi.

Safe-area e responsive usano `viewport-fit=cover`, `env(safe-area-inset-*)`, `system-insets.js` e layout adattivo. Header e contenuto condividono il gutter canonico e la safe-area superiore ha un solo proprietario.

## Quality Matrix e test

Comandi principali:

```bash
npm run build
npm test
npm run test:quality
npm run test:phase0
npm run test:phase1
npm run test:group1
npm run test:group2
npm run test:group3
npm run test:randui
npm run test:e2e
npm run test:device
npm run test:lts
npm run skills:validate
npm run repo:radar
npm run design:check
```

La CI canonica verifica dependency/security audit, Quality Matrix, critical operational gate, multi-hotel parity, production confidence, build/bundle budget, contratti RandApp/RandAI/RandUI/RandBrain/RandAudio, Chromium + WebKit, device acceptance, RandCore health evidence e LTS attestation.

Ogni PR deve essere verde prima di poter essere proposta per merge umano.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

- **Produzione stabile:** Vercel.
- **Preview/test grafici:** DigitalOcean/Ocean.
- Gli agenti non promuovono automaticamente branch in produzione.
- `/ui-v2-preview` resta una superficie di verifica finché il workflow Ocean la usa.

## Documentazione principale

- `docs/architecture/RANDAI_UI_FOUNDATION_V1.md` — ownership UI RandAI, primitive native e decisioni RandRadar.
- `docs/architecture/RANDGATEWAY_POINT7.md` — gateway, adapter, HITL e audit.
- `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md` — tool gateway/eval/telemetry.
- `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md` — knowledge, memoria, RAG e provenance.
- `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md` — durable runtime e resume.
- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` e `docs/RAND_RADAR_POLICY.md` — discovery multisorgente e governance.
- `docs/architecture/RANDDESIGNBRIDGE_V1.md` — Figma ↔ RandUI e visual gate.
- `docs/architecture/RANDSKILLS_V1.md` — formato e governance skill.
- `docs/architecture/RANDCHAT.md` — gruppi, DM E2EE e media.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — desktop/stampa.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — rifornimenti.
- `docs/README-history-2026-09-05.md` — storico roadmap precedente.

Questo README descrive lo **stato operativo corrente**; cronologia e dettagli specialistici restano nei documenti dedicati per evitare duplicazioni e documentazione zombie.
