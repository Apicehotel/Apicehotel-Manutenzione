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

`RAND_FULL_EVOLUTION_V1` rende Repo Radar un motore di scouting dell'intero prodotto, non un radar limitato a categorie statiche.

Il perimetro viene derivato da fonti vive già canoniche:

- **24/24 pagine RandApp** da `src/randapp/randui/page-catalog.js`, con dominio, tipo pagina e capability reali;
- **moduli governati dell'ecosistema Rand** da `src/randai/core/ecosystem.js`;
- **14 fronti evolutivi RandAI**: agent runtime, model routing, tool use/MCP, memoria, RAG/retrieval, eval, observability, guardrail, multimodale, voice, coding agent, learning, ottimizzazione costi e context engineering.

Ogni elemento produce un `inventoryRef` e almeno un profilo di ricerca. La copertura è **fail-closed**: se una pagina, un modulo o un fronte AI resta senza profilo, lo snapshot non può dichiararsi completo.

Il discovery continua sui provider canonici **GitHub, GitLab, Codeberg e npm**. La precedente matrice specialistica RandUI da **35 settori** resta attiva come approfondimento e non viene rimossa.

Le candidate vengono deduplicate e selezionate in modo bounded (`MAX_DISCOVERED=80`, massimo 2 per settore). Stelle e popolarità sono soltanto segnali deboli di discovery. L'adozione continua a richiedere licenza ammessa, manutenzione, sicurezza, compatibilità, benchmark e rollback; una sostituzione richiede superiorità misurabile. **Nessuna discovery auto-installa o auto-sostituisce codice.**

Classificazione concettuale: **Aggiungi / Sostituisci / Ignora / Fonte**. Il runtime interno mantiene anche gli stati governati `KEEP / UPGRADE / REPLACE / ADD / REJECT / WATCH`.

Comando snapshot:

```bash
npm run repo:radar
```

Workflow settimanale: `.github/workflows/repo-radar.yml`.

Dettaglio: `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md`.

## RandSkills

RandSkills introduce competenze modulari e versionate senza creare un secondo sistema di autorizzazione. Ogni competenza vive in `rand-skills/<name>/SKILL.md`; RandCore/RLS/RPC restano l'autorità finale per permessi e mutazioni.

Skill canoniche: `maintenance`, `housekeeping`, `planning`, `warehouse`, `whatsapp`, `procedures`, `repo-radar`.

Il flusso resta:

`objective → RandSkillRouter → skill APPROVED → permission/tool requirements → autorizzazioni caller → risk bound → RandAgentRuntime`

Il router può restringere capacità, mai concederle. Governance e promotion automatica restano limitate a miglioramenti LOW-risk testati e verificati; cambi di boundary, schema, permessi e operazioni distruttive richiedono review.

Comandi:

```bash
npm run skills:validate
npm run test:randskills
npm run test:randskills:governance
```

## RandMind / RandBrain / RandAI

RandMind è la memoria canonica governata con provenienza, temporalità, conflitti, retention e forgetting auditabile. RandBrain governa routing, reasoning graph, autonomia e learning verificato. RandAI usa questi proprietari invece di duplicare memoria, tool registry, agent runtime o orchestrazione.

Principio invariabile: **RandMind può imparare da esiti verificati, ma non può cambiare da solo i confini critici di RandCore**.

## RandCore e Security Intelligence

RandCore governa health, audit, release gate, workers, sicurezza, costi, integrazioni ed evidenze LTS. Le fonti di security intelligence possono segnalare exploit/PoC pubblici e pattern di analisi, ma non possono eseguire exploit nel runtime di produzione né installare codice.

`Exploitarium` resta fonte `SECURITY_INTELLIGENCE`; `reverse-skill` resta donatore `ANALYSIS_PATTERN` sandbox-only; fonti di discovery esterne rientrano sempre nei normali gate RandRadar.

## RandAI Group 1 — Guardrails e observability

Il Gruppo 1 introduce un boundary fail-closed senza creare un secondo sistema di autorizzazione o logging:

- **RandTool Gateway** (`src/randai/core/tool-gateway.js`) filtra i tool prima dell'esposizione al modello e nega tool sconosciuti/disabilitati, caller anonimi, cross-hotel e scope mancanti;
- **Promptfoo** resta fuori dal bundle runtime e viene usato come regression/evaluation gate CI con versione fissata;
- **OpenTelemetry** già presente resta il contratto canonico; `ai-observability.js` aggiunge span `randai.*`, mentre Phoenix può essere collegato come backend OTLP opzionale;
- **ToolHive** resta adapter/runtime MCP opzionale dietro il RandTool Gateway e non può concedere permessi.

Comandi:

```bash
npm run test:group1
npm run eval:randai:security
```

Workflow dedicato: `.github/workflows/randai-group1-security.yml`.

Dettaglio: `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md`.

## RandAI Group 2 — Knowledge, memoria e RAG

Il Gruppo 2 separa in modo definitivo dati, memoria e indici di retrieval:

- **Supabase/Postgres** resta la source of truth dei dati operativi e RLS/RPC resta l'autorità finale;
- **RandMind** resta il proprietario canonico della memoria governata;
- **Graphiti** è adottato come pattern/adapter opzionale per una proiezione temporale e bi-temporale ricostruibile;
- **LightRAG** è adottato come pattern/adapter opzionale per una proiezione di retrieval documentale/ibrido ricostruibile;
- **RandKnowledge Gateway** (`src/randai/core/knowledge-gateway.js`) applica identità, `hotelId`, `knowledge:read`, provenienza canonica e validità temporale prima che il contesto raggiunga RandAI.

Graphiti e LightRAG non entrano nel bundle PWA e non diventano store canonici. Un indice può essere cancellato e rigenerato dalle fonti autorizzate senza perdita della verità operativa. I risultati di projection senza `canonicalRef`, fuori hotel o fuori finestra temporale vengono scartati; un backend esterno indisponibile degrada in sicurezza lasciando RandMind operativo.

Comando:

```bash
npm run test:group2
```

Workflow dedicato: `.github/workflows/randai-group2-knowledge.yml`.

Dettaglio: `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md`.

## RandAI Group 3 — Durable runtime

`RandDurableRuntime` aggiunge idempotenza, checkpoint/resume, retry bounded, cancellazione e versionamento dei workflow. Ogni resume rivalida actor/hotel/scope e ricarica conoscenza fresca prima dell'esecuzione. Il recovery engine esistente resta separato e vivo; nessun nuovo orchestratore esterno entra nel bundle PWA.

Trigger.dev resta il primo executor server-side candidato quando un workload reale lo richiede; Inngest resta alternativa, Mastra eventuale agent engine e LangGraph reference. RandCore continua a possedere permessi, audit, costi e policy.

Comando:

```bash
npm run test:group3
```

Workflow dedicato: `.github/workflows/randai-group3-durable.yml`.

Dettaglio: `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md`.

## RandUI

RandUI è il design system canonico. Il flusso è:

`Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell`

Il catalogo copre **24/24 destinazioni correnti** e usa 14 template ufficiali. Il Guard è fail-closed su composizione, overflow, viewport, touch target, accessibilità e ID DOM. La matrice principale copre **320 / 375 / 390 / 430 / 768 / 1024 / 1440 px**, oltre a Chromium e WebKit.

La navigazione mobile mantiene Operatività nello slot 1, Planning nello slot 2, Home nello slot 3, destinazione operativa/RandChat nello slot 4 e RandAI nello slot 5. Il menu completo vive nel controllo profilo/nome.

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, magazzino, urgenze, promemoria, sensori/temperature, utenti/ruoli, guide, feedback, desktop e RandAI.

Warehouse resta bounded domain con ledger, stock/seriali e integrazione con Interventi. Rifornimenti resta un workflow operativo separato dal Magazzino e non crea quantità o movimenti Warehouse.

RandChat riusa identità e autorizzazioni RandApp; gruppi, DM E2EE, Procedure/RandGuide, RandAI e RandMedia restano bounded dai rispettivi gate. RandDesktop riusa RandApp e aggiunge solo capacità native ristrette per Windows/desktop.

## Safe-area e target device

Il contratto responsive usa `viewport-fit=cover`, `env(safe-area-inset-*)`, `src/randapp/system-insets.js` e `adaptive-layout.css`. Header e contenuto condividono lo stesso gutter canonico; la safe-area superiore ha un solo proprietario per evitare doppio spazio su iPhone.

## Quality Matrix e test

Comandi principali:

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

`npm test` include anche `test/randradar-full-evolution-v1.test.js`, che blocca regressioni su inventario reale, copertura 24/24 pagine, manifest ecosistema, 14 fronti AI, `inventoryRef`, provider multi-source e invarianti di adozione.

La CI certifica inoltre dependency/security audit, Quality Matrix, critical operational gate, multi-hotel parity, production confidence, build/bundle budget, contratti RandBrain/RandUI/RandAudio/Viking/RandAI/RandApp, Chromium + WebKit, device acceptance, RandCore health evidence e Rand Ecosystem LTS attestation. I workflow RandAI Group 1, Group 2 e Group 3 aggiungono rispettivamente tool authorization/evaluation, knowledge provenance/temporal boundary e durable lifecycle/resume.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

Produzione stabile: Vercel. Durante l'unificazione RandUI v1 i Git deploy Vercel restano congelati (`deploymentEnabled: false`); prove e deploy della nuova UI vanno su DigitalOcean/Ocean finché non viene decisa esplicitamente la riattivazione.

## Documentazione

- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` — inventario vivo, scouting completo RandApp/RandAI, coverage fail-closed e governance.
- `docs/architecture/RANDSKILLS_V1.md` — formato skill e governance.
- `docs/architecture/RANDSKILLS_ROUTER_BLOCK1.md` — routing e tool bounding.
- `docs/architecture/RANDSKILLS_GOVERNANCE_BLOCK2.md` — lifecycle, overlap e zombie policy.
- `docs/architecture/RANDMIND_LEARNING_BLOCK2.md` — cognitive loop e learning verificato.
- `docs/architecture/RANDCORE_SECURITY_INTELLIGENCE_BLOCK3.md` — security intelligence e sandbox boundary.
- `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md` — tool gateway, Promptfoo, OTLP/Phoenix e boundary ToolHive.
- `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md` — separazione Supabase/RandMind/Graph/RAG, provenance e temporal retrieval.
- `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md` — durable execution, resume, idempotenza e boundary executor.
- `docs/architecture/RANDUI_V1_CORE.md` — RandUI Core.
- `docs/architecture/RANDUI_V1_GUARD.md` — guard fail-closed.
- `docs/architecture/RANDUI_V1_MIGRATION.md` — PageBoundary e migrazione.
- `docs/architecture/RANDUI_VISUAL_LANGUAGE_V1.md` — visual language.
- `docs/architecture/RANDUI_TELEGRAM_NAVIGATION_V1.md` — navigazione mobile.
- `docs/architecture/RANDCHAT.md` — RandChat ed E2EE.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — RandDesktop e stampa nativa.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — Rifornimenti.
- `docs/README-history-2026-09-05.md` — storico esteso delle roadmap e dei blocchi precedenti.

Questo README rappresenta lo **stato corrente** e resta volutamente operativo; i dettagli storici e specialistici vivono nei documenti dedicati.
