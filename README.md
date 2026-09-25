# RandApp - Manutenzione / RandAI — Hotel Operations Platform

## Ownership RandAILive

Il gioco RandAILive appartiene esclusivamente al repository [Apicehotel/RandAIlive](https://github.com/Apicehotel/RandAIlive). Questo repository contiene RandApp/RandAI operativo e non deve ricevere modifiche al runtime, alla mappa o alla grafica del gioco.


PWA interna React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target verificati dalla Quality Matrix: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato consolidato — 25 settembre 2026

RandUI rebuild v1 è chiuso e integrato. La shell, la navigazione adattiva, i contratti responsive e le 24 destinazioni RandUI hanno un proprietario unico. RandApp è l'app operativa; RandAI è l'assistente e control layer integrato. RandMind, RandResearch, RandBrain, RandUI, RandDesignBridge, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dello stesso ecosistema, non applicazioni parallele.

Il cambio tab della bottom nav non aspetta più uno spinner a ogni tap: i chunk delle destinazioni principali vengono precaricati in idle / al tocco, e le liste operative (Segnalazioni, Interventi, Urgenti, Task, Planning) ridipingono subito da cache di sessione/IndexedDB con refresh soft in background.

Le notifiche ntfy sono gestibili senza SQL: in **Impostazioni → ntfy** l’admin attiva/disattiva il canale, completa i topic hotel/ruolo mancanti e invia un test urgente. In **Profilo** l’operatore resta sui soli short link personali (`/n/GIO-AV-……`) con test per canale; i topic tecnici non vengono mostrati. La diagnostica considera ntfy “ok” solo dopo setup + test riuscito.

Dopo il merge codice serve anche il **deploy edge** su Supabase (`ntfy-admin` + aggiornamenti `ntfy-config`/`ntfy-resolve`/`ntfy-alert`) e la migrazione `20260923180000_ensure_ntfy_alerts.sql`. Smoke: `node scripts/smoke-ntfy-edge.mjs` (404 su `ntfy-admin` = non ancora pubblicato).

Le liste operative Segnalazioni / Interventi / Urgenze usano `ListFetchNotice` + `SystemState`: un fetch fallito non diventa più un falso “vuoto”. Con cache locale resta la lista più un banner stale/offline e Riprova; senza cache compare offline/error onesto.

Il caricamento pagine è hardened contro i fallimenti intermittenti tipici della PWA: `lazyWithRetry` sui chunk, timeout 12s su sessione/directory/login, `ViewErrorBoundary` per sezione e overlay, timeout 15–45s sulle liste operative, `createTimedFetch(20s)` sul client Supabase, e service worker v16 che in online non ripiega su uno shell HTML stale (causa tipica di “pagina che non carica” post-deploy).

Su phone/tablet lo shell è viewport-locked: header (e fascia urgenti) restano fissi; scorre solo `.rs-content`.

La Home è una **mini-scrivania**: KPI a striscia, banco personale (prossimo + tuoi + team), attrezzi a portata, poi vassoio “Da smaltire”. Su desktop/Windows (≥1200px) banco e vassoio stanno affiancati.

Principio permanente: **un solo proprietario canonico per capacità**. Se una soluzione è realmente migliore, più semplice e più sicura, sostituisce quella debole; non accumuliamo framework, patch o sistemi duplicati.

**README:** ogni PR sostanziale aggiorna questo file allo stato operativo corrente (niente documentazione zombie; la cronologia resta nei docs dedicati).

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

La standardizzazione RandUI mantiene `RANDUI_VERSION=1.0.0` e governa separatamente token portabili, motion con reduced-motion fail-safe e adapter semantico delle icone. Il prototipo runtime `randui-v2` è stato rimosso: RandUI canonico vive sotto `src/randapp/randui/` e la geometria resta di `adaptive-layout.css`.

### Densità operativa (Operatività / Task / Planning)

Nav primaria mobile: Operatività · Planning · Home · Task · RandAI (Home al centro).

- **Operatività** = hub anteprima stile Planning: card **Segnalazioni** + **Interventi** (top 3 KPI ciascuna). **Niente Planning** qui.
- **Task** = hub anteprima: card **Avvisi** + **Promemoria** (come Ops). Lista **I miei lavori** sotto, senza terza card. **Niente Planning** qui.
- **Planning** (tab dedicato) = hub completo (lavori, sale, panoramica, calendario).
- Ritmo condiviso `rs-ops-surface` / `rs-randui-choice` su Operatività, Task, Planning (owner: `visual-language.css` + `telegram-navigation.css`).
- Titolo → contenuto senza banda vuota verticale: stack `align-content:start` / `grid-auto-rows:max-content`.

### Focus operativo — dettaglio unico

Segnalazioni e Interventi usano `OperationalDetailPage` come proprietario canonico del dettaglio: la lista non resta montata sotto, la Shell entra in **Focus Mode** e sospende header/sidebar, fascia urgenti, bottom nav e FAB. Il dettaglio mantiene il proprio scroll e un comando **Indietro** persistente in basso, con safe-area adattive iOS/Android e layout desktop. Il contratto accetta i domini `issue`, `intervention`, `task`, `supply`; Task e Rifornimenti riuseranno la stessa superficie quando aprono una singola risorsa, senza creare nuove varianti di popup/drawer.
Il footer è ora l’**Operational Dock**: `Indietro` resta stabile a sinistra e il dominio può fornire una sola azione primaria autorizzata a destra. Segnalazioni usa lo stato corrente (Da fare / Attesa pezzo / Tecnico) per scegliere l’azione; Interventi porta il completamento nel Dock e lo disabilita finché esistono ricambi pendenti. Le azioni primarie duplicate nel corpo sono vietate.
Il corpo del Focus Mode usa inoltre una **Operational Timeline evidence-first** condivisa: mostra soltanto eventi ricavabili dai dati reali, senza inventare timestamp mancanti. Segnalazioni visualizza apertura, ricambio, tecnico e completamento; Interventi aggiunge programmazione, assegnazione, ricambi con timestamp reali e chiusura. Foto iniziali/finali e note storiche sono legate all’evento pertinente invece di essere replicate in card separate.
RandAI nel Focus Mode è una **presenza contestuale inline**, non una destinazione: compare in forma compatta dopo la Timeline e si espande nello stesso flusso. Segnalazioni riusano workspace, procedure e Gateway/HITL esistenti; Interventi ricevono analisi read-only basata sul proprio context envelope e sui ricambi già caricati. Nessuna mutazione Intervento viene introdotta finché non esiste un action contract governato dedicato.
La convergenza del dettaglio copre ora anche **Avvisi, Promemoria e Richieste Rifornimenti**. Task resta un hub Avvisi+Promemoria e Planning resta una vista aggregata: il Focus Mode si applica soltanto alla singola risorsa. Avvisi/Promemoria usano `kind="task"`, Rifornimenti `kind="supply"`; tutti condividono Dock e Timeline evidence-first. RandAI non viene esteso a Task/Supply finché il context contract server-side non supporta esplicitamente questi tipi.
Il contratto cross-platform usa un solo **viewport adattivo canonico**: safe-area browser/native + VisualViewport alimentano `--rs-app-viewport-height` e `--rs-app-viewport-min-height`, consumati da Shell, Focus Mode e superfici full-screen. Il bridge gestisce tastiera, resize, rotazione e teardown senza lasciare token stale; la modalità Grande aumenta anche Dock e touch target. Il contratto copre phone, tablet, landscape e desktop senza fork iOS/Android.
La **pulizia zombie runtime** mantiene un solo owner per la Shell: la geometria tablet vive esclusivamente in `adaptive-layout.css`, il vecchio fix urgente separato è stato assorbito nello stesso owner e il prototipo isolato `/ui-v2-preview` è stato rimosso dal runtime. La documentazione storica RandUI resta come evidenza, ma non esiste più una seconda shell caricabile accanto a RandApp.
## RandAI, RandMind e RandResearch

Le superfici RandAI restano due: **pagina chat dedicata** in RandApp (tab RandAI + header, fissata tra header e bottom nav con composer in basso; conversazione preservata tra i tab) e **Control Center `/randai`** protetto e multi-hotel (URL diretta, non nella nav primaria).

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

### Shared Actions / Agent-Native contract

RandApp adotta il pattern Agent-Native **define once, reuse everywhere** senza introdurre un secondo runtime applicativo. Il catalogo canonico `src/randai/actions/catalog.js` descrive le capacità condivise da RandApp, RandAI/agenti e MCP; la policy server-side resta indipendente e fail-closed.

Le azioni operative attuali (`issue.update_priority`, `issue.set_waiting_part`, `issue.mark_done`) sono private, hotel-scoped e HITL. MCP genera i propri tool dal catalogo invece di mantenere una seconda lista manuale; RandAI dispone di un bridge verso `ToolRegistry` che richiede esplicitamente un dispatcher governato. Agent-Native completo non è una dipendenza runtime: un eventuale worker futuro dovrà chiamare RandGateway e non potrà possedere auth, RLS, audit o scritture operative dirette.

## RandRadar Full Evolution

Repo Radar deriva il perimetro dalle 24 pagine RandApp, dai moduli governati e dai fronti evolutivi RandAI. Il discovery automatico usa GitHub, GitLab, Codeberg, Gitee, npm, crates.io, Hugging Face e Open VSX; la policy manuale copre anche marketplace, registri MCP, Figma Community, Storybook e altre fonti pertinenti.

Classificazione: **Aggiungi / Sostituisci / Ignora / Fonte**; runtime interno `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`. Nessuna discovery auto-installa codice.

Le **Fonti** architetturali restano `REFERENCE_ONLY`: insegnano pattern ma non entrano nel runtime. `binhnguyennus/awesome-scalability` è la prima fonte curata e alimenta `docs/architecture/RAND_ARCHITECTURE_PLAYBOOK_V1.md`, con pattern minimi per timeout/retry/circuit breaker, code/idempotenza/dead-letter, rate limiting, cache/stale state, observability e graceful degradation. Regola: adattare alla scala Rand, non imitare infrastrutture hyperscale.

```bash
npm run repo:radar
```

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, warehouse, urgenze, promemoria, sensori/temperature, utenti/ruoli, RandGuide, feedback, RandChat, RandDesktop e RandAI.

Warehouse mantiene ledger/stock/seriali e integrazione con Interventi. Rifornimenti resta un workflow distinto e non crea quantità o movimenti Warehouse. RandChat riusa identità e autorizzazioni RandApp; DM E2EE e media mantengono i rispettivi boundary. RandDesktop riusa RandApp e aggiunge solo capacità native ristrette.

## Offline e device

RandApp usa un solo stack offline: Service Worker + sessione locale controllata + Dexie/IndexedDB. Safe-area e responsive usano `viewport-fit=cover`, `env(safe-area-inset-*)`, `system-insets.js` e layout adattivo. Header e contenuto condividono il gutter canonico e la safe-area superiore ha un solo proprietario.

Registrazione PWA fallita (race di preview/CDN) resta non bloccante: `console.warn` lato client; il gate e2e non tratta quel TypeError come errore fatale della shell.

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
npm run test:chaos
npm run test:lts
npm run skills:validate
npm run spec:validate
npm run repo:radar
npm run design:check
npm run release:check
```

La CI canonica verifica RandSpec, dependency/security audit, Phase 0/1, Quality Matrix, critical operational gate, **Operational chaos gate**, multi-hotel parity, production confidence, build/bundle budget, contratti RandApp/RandAI/RandUI/RandBrain/RandAudio, Chromium + WebKit, device acceptance, RandCore health evidence e LTS attestation. Il chaos gate protegge le mutazioni del Focus Mode da doppio invio e chiusure premature: su errore il dettaglio resta aperto e mostra feedback inline.

Il **Web Release Readiness gate** (`npm run release:check`) è ora parte della CI canonica. Subito dopo, il **Final Freeze gate** (`npm run freeze:check`) produce `artifacts/randapp-final-freeze.json` e blocca il freeze se web readiness, separazione ambienti, revisione umana o invarianti anti-zombie non sono coerenti.

Stato distribuzione al freeze:
- **Web/PWA:** target canonico, deve risultare `READY`.
- **Android nativo:** `BLOCKED` finché mancano pacchetto firmato e prova su dispositivo reale; `npm run release:check:android` resta fail-closed.
- **iOS privata / Apple Business Manager:** `DEFERRED` finché non esiste evidenza di firma/distribuzione e test reale.
- **Windows:** PWA/browser supportato; installer nativo firmato separato e `DEFERRED`.

Dopo il merge del gate finale RandApp entra in **RandApp LTS 1.0 / FROZEN** per un orizzonte operativo di 12 mesi: solo bugfix, sicurezza, recovery e documentazione. Feature/refactor/schema/major dependency richiedono eccezione umana esplicita, rollback e release gate verde. Policy: `docs/governance/RELEASE_FREEZE.md`.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

- **Produzione stabile:** Vercel.
- **Preview/test grafici:** DigitalOcean/Ocean (`randui-preview`).
- Prima del Browser visual gate Ocean, la CI attende che `/sw.js` risponda **200 con MIME javascript** (evita race del catchall `index.html` sul preview condiviso).
- Gli agenti non promuovono automaticamente branch in produzione.
- Il vecchio prototipo `/ui-v2-preview` è stato rimosso dal runtime; Ocean verifica direttamente la RandApp canonica.

## Documentazione principale

- `docs/governance/RAND_CONSTITUTION.md` — ownership, freeze, HITL e change protocol.
- `docs/governance/RELEASE_FREEZE.md` — RandApp LTS 1.0, cambi ammessi, eccezioni e distribuzione.
- `docs/architecture/RANDSPEC_V1.md` — specifiche governate e convergenza.
- `docs/architecture/RANDCORE_RUNTIME_V2.md` — runtime core, eventi e health.
- `docs/architecture/RAND_GOVERNANCE_V1.md` — governance runtime.
- `docs/architecture/RANDMIND_V2.md` — memoria verificata e temporal governance.
- `docs/architecture/RANDRESEARCH_V1.md` — deep research evidence-first.
- `docs/architecture/RANDAI_RUNTIME_HITL_V1.md` — HITL, risk policy e sandbox.
- `docs/architecture/RANDUI_STANDARDIZATION_V1.md` — token, motion e icone.
- `docs/architecture/RANDAI_UI_FOUNDATION_V1.md` — ownership UI RandAI.
- `docs/architecture/RANDGATEWAY_POINT7.md` — gateway, adapter, HITL e audit.
- `docs/architecture/AGENT_NATIVE_ACTIONS.md` — action catalog condiviso e confini Agent-Native.
- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` e `docs/RAND_RADAR_POLICY.md` — discovery multisorgente e governance.
- `docs/architecture/RAND_ARCHITECTURE_PLAYBOOK_V1.md` — pattern di reliability/scalability adattati alla scala Rand da fonti `REFERENCE_ONLY`.
- `docs/architecture/RANDDESIGNBRIDGE_V1.md` — Figma ↔ RandUI e visual gate.
- `docs/architecture/RANDCHAT.md` — gruppi, DM E2EE e media.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — desktop/stampa.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — rifornimenti.

Questo README descrive lo **stato operativo corrente**. Cronologia e dettagli specialistici restano nei documenti dedicati per evitare documentazione zombie.

## Governed design and PR review tools

RandApp uses Impeccable as a development-only UI design and audit layer, and agent-reviews as a controlled PR review-bot triage aid. They never run in the production runtime and never bypass the branch/PR/human-review policy.

See [docs/integrations/BAKAUS_TOOLS.md](docs/integrations/BAKAUS_TOOLS.md), [.impeccable/PRODUCT.md](.impeccable/PRODUCT.md), and [.impeccable/DESIGN.md](.impeccable/DESIGN.md).
