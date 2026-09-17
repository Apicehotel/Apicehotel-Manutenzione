# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA interna React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target: iOS/iPadOS, Android, tablet e Windows/desktop.

## Stato consolidato — 17 settembre 2026

**RandUI rebuild v1 è integrato in `main` tramite PR #267.** Shell, navigazione adattiva, contratti responsive e 24 destinazioni hanno un proprietario unico.

**RandAI native surfaces v1 è integrato in `main` tramite PR #270.** Quick Assistant e Control Center condividono RandUI, safe-area, touch target, focus, reduced-motion e forced-colors; gli alias legacy `--rc-*` restano soltanto come bridge temporaneo.

**RandUI Standardization v1** aggiunge sopra la rebuild esistente un contratto portabile di design token, motion e icone semantiche, senza creare un secondo design system. Dettaglio: `docs/architecture/RANDUI_STANDARDIZATION_V1.md`.

Principio permanente: **un solo proprietario canonico per capacità**. Se una soluzione è realmente migliore, più semplice e più sicura, sostituisce quella debole dietro un adapter/contract; non accumuliamo framework o sistemi paralleli.

## Stack canonico

- React 19 + Vite 7 per la PWA.
- Supabase/Postgres per dati, Auth, RLS/RPC, Realtime e source of truth operativa.
- RandUI come design system unico.
- RandGateway come unico ingresso governato per Web/RandApp, RandChat, MCP e WhatsApp/Twilio.
- RandCore per health, audit, release gate, workers, sicurezza, costi e integrazioni.
- DigitalOcean/Ocean per preview e workload esterni/pesanti; Vercel resta la produzione stabile.
- Node 24.x; `.nvmrc` è il riferimento per sviluppo/CI.

## Confini invariabili

- `hotel_id`, membership e scope hotel sono obbligatori.
- Supabase RLS/RPC è l'autorità finale: nascondere una funzione nella UI non concede permessi.
- RandAI riceve solo contesto autorizzato e hotel-scoped.
- Nessun frontend/modello riceve `service_role`, PIN, refresh token o secret non necessari.
- Mutazioni protette passano da Safe Write / Tool Gateway / RandSecure-HITL / Action Gateway / audit.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Nessun secondo sistema per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario, discovery o rollback.
- Una parte è zombie soltanto dopo verifica di utilizzo, riferimenti runtime/CI e dipendenze.
- Nessun agente può pushare/mergiare/deployare direttamente `main`: branch + PR + CI + revisione umana.

## RandUI

Flusso canonico:

`Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell`

Il catalogo copre **24/24 destinazioni** con 14 template. RandUI Guard è fail-closed su composizione, overflow, viewport, touch target, accessibilità e ID DOM. La matrice responsive copre 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px, Chromium e WebKit.

### Standardizzazione v1

- `src/randapp/randui/design-tokens.json` — contratto DTCG-compatible per spacing, radius, layout/touch e motion.
- `src/randapp/randui/motion-contract.js` — durate/easing canonici e reduced-motion fail-safe.
- `src/randapp/randui/icon-contract.js` — nomi semantici, un solo owner runtime e migrazione adapter-first.
- `test/randui-standardization-v1.test.js` — gate automatico; entra già in `npm test` tramite `test/*.test.js`.

MingCute è il target iconografico approvato, ma non viene aggiunto come dipendenza finché la migrazione non può avvenire dietro l'adapter unico con lockfile/test completi. Anime.js è candidato come eventuale motore motion solo se riduce complessità; EaseMaster resta authoring tool. Penpot/Figma/M3E Canvas restano strumenti di design, non runtime paralleli.

`src/randapp/randui-v2/` e `/ui-v2-preview` **non è zombie** finché il gate Ocean/CI li usa. La rimozione richiede zero import runtime, zero route/gate, zero riferimenti CI e un sostituto verificato.

## RandAI

Superfici native:

- **Quick Assistant**: popup contestuale autenticato dentro RandApp.
- **Control Center `/randai`**: pagina completa protetta, amministrativa e multi-hotel.

Le primitive AI sono UI soltanto: non concedono permessi e non bypassano RandGateway.

Runtime/knowledge:

- Group 1: Tool Gateway, Promptfoo, OpenTelemetry e ToolHive opzionale dietro gate.
- Group 2: Supabase source of truth, RandMind memoria canonica, projection/RAG ricostruibili, provenance e temporal scope.
- Group 3: durable runtime per checkpoint/resume/cancel/idempotenza con re-authorization a ogni resume.
- RandBrain governa model routing, reasoning graph, autonomia e learning verificato.

## RandGateway

Flusso:

`adapter → RandGateway → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Gli adapter producono envelope canonici ma non decidono identità, hotel, ruolo, rischio o permessi.

## RandRadar

Repo Radar usa GitHub, GitLab, Codeberg, Gitee, npm, crates.io, Hugging Face e Open VSX; la policy manuale copre anche marketplace, registri MCP, Figma Community, Storybook e altre fonti pertinenti.

Classificazione: **Aggiungi / Sostituisci / Ignora / Fonte**; runtime interno `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`.

Nessuna discovery auto-installa codice. Ogni adozione richiede manutenzione, sicurezza, compatibilità, licenza, benchmark, rollback e ownership chiaro.

```bash
npm run repo:radar
```

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, warehouse, urgenze, promemoria, sensori/temperature, utenti/ruoli, RandGuide, feedback, RandChat, RandDesktop e RandAI.

## Offline e device

Un solo stack offline: Service Worker + sessione locale controllata + Dexie/IndexedDB. Safe-area e responsive usano `viewport-fit=cover`, `env(safe-area-inset-*)`, `system-insets.js` e layout adattivo.

## Quality Matrix e test

Comandi principali:

```bash
npm run build
npm test
npm run test:quality
npm run test:randui
npm run test:e2e
npm run test:device
npm run test:group1
npm run test:group2
npm run test:group3
npm run test:lts
npm run skills:validate
npm run repo:radar
npm run design:check
```

Ogni PR deve essere verde prima di essere proposta per merge umano.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

- **Produzione stabile:** Vercel.
- **Preview/test grafici:** DigitalOcean/Ocean.
- Gli agenti non promuovono branch in produzione.
- `/ui-v2-preview` resta una superficie di verifica finché Ocean/CI la usa.

## Documentazione principale

- `docs/architecture/RANDUI_STANDARDIZATION_V1.md` — token, motion, icone e gate.
- `docs/architecture/RANDAI_UI_FOUNDATION_V1.md` — ownership UI RandAI.
- `docs/architecture/RANDGATEWAY_POINT7.md` — gateway, adapter, HITL e audit.
- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` e `docs/RAND_RADAR_POLICY.md` — discovery multisorgente.
- `docs/architecture/RANDDESIGNBRIDGE_V1.md` — Figma ↔ RandUI e visual gate.
- `docs/architecture/RANDSKILLS_V1.md` — formato e governance skill.
- `docs/architecture/RANDCHAT.md` — gruppi, DM E2EE e media.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — desktop/stampa.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — rifornimenti.
- `docs/README-history-2026-09-05.md` — storico roadmap precedente.

Questo README descrive lo **stato operativo corrente**; i dettagli specialistici restano nei documenti dedicati per evitare documentazione zombie.
