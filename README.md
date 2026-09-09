# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target supportati e testati: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato attuale

RandApp è l'app operativa. RandAI è l'assistente e control layer integrato; RandMind, RandBrain, RandArchitecture, RandUI, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dell'ecosistema, non applicazioni parallele.

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

## OpenAI Plugins governance + RandFlow

`https://github.com/openai/plugins` è registrato in RandRadar come `CAPABILITY_CATALOG` `SOURCE_ONLY`: è una fonte ufficiale di pattern e integrazioni, non una dipendenza monolitica né una trust root. Nessun plugin viene auto-installato e nessun plugin riceve autorità produttiva.

Priorità v1: `build-web-apps` → `ADOPT_PATTERN`, `plugin-eval` e `superpowers` → `ADAPT`, GitHub/Supabase/Vercel → `CONNECT`; `codex-security` resta esterno perché proprietario e RandCore continua a essere l'autorità di sicurezza. Figma/Sentry/PostHog restano `WATCH` finché non superano overlap, privacy e stabilità.

RandFlow formalizza il lavoro agente: `DISCOVER → PLAN → IMPLEMENT → TEST → SECURITY → REVIEW → READY_FOR_HUMAN_MERGE`. Branch dedicato, test/security/CI verdi, zero irrisolti e revisione umana sono obbligatori; niente push agente diretto su `main`, merge automatico o deploy produzione prima dell'approvazione.

La CI canonica valida **ogni pull request**, incluse le PR stacked su branch di lavoro: cambiare la base della PR non può bypassare security audit, Quality Matrix, build, contratti RandApp/RandAI/RandUI, browser/device acceptance o gli altri release gate. I push restano invece limitati alle branch esplicitamente governate. Il contratto è protetto da `test/randai-rand-flow-ci-contract.test.js`.

Dettaglio: `docs/architecture/RAND_OPENAI_PLUGINS_ADOPTION_V1.md`.

### Rand Foundations — Gruppo 1

Il consolidamento delle fonti PI-Desktop, Superpowers e RandFocus non crea un secondo agent runtime. RandFlow resta il proprietario canonico del lifecycle; `agent-permission-gate.js` aggiunge il boundary `read/propose/write/execute/deploy`, mentre `rand-focus.js` governa il reporting fail-closed dello stato del lavoro.

- un agente può leggere/proporre senza branch di mutazione;
- write/execute/deploy da agente richiedono branch dedicata e sono vietati sulla base branch (`main` di default);
- il deploy produzione è human-only e richiede approvazione umana esplicita;
- RandFocus non può dichiarare `DONE` senza completamento reale, test, security e CI verdi e zero lavoro irrisolto;
- Superpowers è già adattato nei principi RandFlow (TDD dove utile, debugging sistematico, evidenza prima del completamento, cambio minimo coerente), quindi non viene creato un RandDev parallelo;
- PI-Desktop resta fonte di pattern e non diventa runtime/dependency di RandApp.

RandVisual (`diagram-design` + `awesome-gpt-image-2`) e RandArchitecture (`system-design-notes`) restano i proprietari già separati e governati dei rispettivi domini.

Test dedicato: `test/rand-foundations-group1.test.js`.

Dettaglio: `docs/architecture/RAND_FOUNDATIONS_GROUP1.md`.

### Plugin evaluation governata

`plugin-eval` viene adattato come pattern, non installato come secondo evaluator. **Promptfoo + Quality Matrix restano il motore canonico**; `scripts/rand-plugin-eval.mjs` aggiunge una policy versionata con dimensioni obbligatorie, ordinamento `Fix First`, report JSON/Markdown e confronto before/after.

Le dimensioni minime sono sicurezza, isolamento hotel, permessi, correttezza, regressioni, costi, manutenibilità e rollback. Un finding critico blocca il gate. Anche un `PASS` non abilita merge o deploy automatici: la review umana resta obbligatoria.

Comandi:

```bash
npm run eval:plugin
npm run eval:plugin:compare -- before.json after.json
```

Il workflow Group 1 salva il report come artifact di CI per 14 giorni. Dettaglio: `docs/architecture/RAND_PLUGIN_EVAL_ADAPTATION_V1.md`.

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
npm run eval:plugin
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

Il Gruppo 3 introduce `RandDurableRuntime` come contratto canonico per workflow lunghi/riprendibili senza creare un secondo orchestratore:

- identità, `hotelId` e `workflow:execute` obbligatori;
- idempotency key obbligatoria;
- checkpoint, resume e cancel deterministici;
- ogni resume rivalida identità/hotel/scope e ricarica conoscenza fresca;
- `workflowId` + `workflowVersion` impediscono resume incompatibili;
- retry solo espliciti e bounded;
- tracing riusa OpenTelemetry del Gruppo 1;
- recovery engine esistente resta proprietario del recovery locale;
- Trigger.dev resta executor esterno opzionale, non dipendenza del PWA.

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

La navigazione mobile mantiene **Operatività** nello slot 1, **Planning** nello slot 2, **Home** nello slot 3, **Task** nello slot 4 per i ruoli autorizzati e **RandAI** nello slot 5. Se Task non è autorizzato, lo slot 4 può degradare a una destinazione operativa consentita. Il menu completo vive nel controllo profilo/nome.

Contratto delle azioni RandUI: la bottom navigation **naviga soltanto**; il `+` crea esclusivamente l'oggetto del contesto attivo. Quindi Interventi → `Nuovo intervento`, Planning lavori → `Nuovo lavoro`, Planning sale → `Nuova attività sala`. Le richieste di creazione vengono azzerate quando si naviga per evitare che una vecchia modale si riapra entrando nuovamente nella sezione.

## RandVisual — Blocco 2

RandVisual è il motore visuale governato, separato da RandUI: riusa i contratti/layout/renderer SVG sicuri già presenti e aggiunge la governance delle fonti esterne e della futura pipeline immagini.

- `cathrynlavery/diagram-design` → `ADAPT`: pattern editoriali, gerarchia, leggibilità e accessibilità; nessuna dipendenza runtime o esecuzione remota.
- `freestylefly/awesome-gpt-image-2` → `SOURCE_ONLY`: tassonomia e riferimenti per prompt visuali; nessuna copia automatica dei prompt di terzi e verifica dei diritti per uso commerciale.
- I piani immagine richiedono `hotelId`, mantengono provenance, minimizzano/redigono dati sensibili e producono sempre una bozza finché non approvata.
- RandCore/RLS/RPC restano autorità; RandVisual non crea un secondo sistema di permessi o un secondo design system.

Test dedicato: `test/randvisual-block2-sources.test.js`.

Dettaglio: `docs/architecture/RANDVISUAL_BLOCK2.md`.

## RandArchitecture — Blocco 3

RandArchitecture è l'advisor di system design evidence-based dell'ecosistema Rand. Usa `liquidslr/system-design-notes` solo come **SOURCE_ONLY** e non copia né installa il repository nel runtime.

- Catalogo v1: idempotenza, optimistic concurrency/CAS, queue asincrone, transactional outbox, retry con jitter, circuit breaker, rate limiting, observability, cache, notification fan-out e chat delivery.
- Se un pattern è già implementato, la decisione è `KEEP`: niente framework o servizi duplicati.
- Se un pattern può servire ma manca evidenza, la decisione è `EVALUATE`: niente auto-provisioning e niente `ADD` automatico.
- RandCore, Supabase/RLS/RPC, RandMind/RandKnowledge e i bounded domain esistenti restano proprietari canonici.
- RandArchitecture può alimentare RandAI/RandBrain per valutazioni e RandVisual per diagrammi, senza diventare un secondo RAG o database.

Test dedicato: `test/randarchitecture-block3.test.js`.

Dettaglio: `docs/architecture/RANDARCHITECTURE_BLOCK3.md`.

## Moduli operativi

RandApp comprende segnalazioni, interventi, planning lavori e sale, housekeeping, rifornimenti, magazzino, urgenze, promemoria, sensori/temperature, utenti/ruoli, guide, feedback, desktop e RandAI.

Warehouse resta bounded domain con ledger, stock/seriali e integrazione con Interventi. Rifornimenti resta un workflow operativo separato dal Magazzino e non crea quantità o movimenti Warehouse.

RandChat riusa identità e autorizzazioni RandApp; gruppi, DM E2EE, Procedure/RandGuide, RandAI e RandMedia restano bounded dai rispettivi gate. RandDesktop riusa RandApp e aggiunge solo capacità native ristrette per Windows/desktop.

## Safe-area e target device

Il contratto responsive usa `viewport-fit=cover`, `env(safe-area-inset-*)`, `src/randapp/system-insets.js` e `adaptive-layout.css`. Header e contenuto condividono lo stesso gutter canonico; la safe-area superiore ha un solo proprietario per evitare doppio spazio su iPhone.

## Bootstrap e continuità offline

RandApp usa un solo stack offline, già condiviso dai moduli operativi: **Service Worker + sessione locale controllata + Dexie/IndexedDB (`offline-store.js`)**. Non esiste un secondo database offline.

- l'ultimo accesso validato viene conservato localmente e può essere riutilizzato offline per un massimo di **24 ore**;
- dopo un accesso online valido `offline-preload.js` scalda in background, con TTL di 10 minuti, soltanto i moduli consentiti dai permessi dell'utente: Segnalazioni, Interventi/Planning, Sale, Urgenze e Rifornimenti;
- directory e collezioni operative già sincronizzate vengono lette dalla cache IndexedDB per hotel, così l'ultimo stato pre-offline resta disponibile;
- Rifornimenti conserva anche prodotti, richieste recenti e contesti area/piano; le relative scritture restano online-only finché il contratto server non offre idempotenza sufficiente per una coda sicura;
- Housekeeping mantiene il proprio cache/outbox locale già esistente; non viene duplicato o migrato solo per uniformità cosmetica;
- il Service Worker mantiene app shell e asset già caricati, oltre al fallback di navigazione;
- un errore di chunk/deployment mentre il dispositivo è offline **non può cancellare le cache PWA né forzare un reload distruttivo**: il recovery viene rinviato fino al ritorno della rete;
- quando la rete ritorna, la normale validazione Supabase/RandCore torna autoritativa; lo stato persistito non diventa un'autorizzazione permanente;
- operazioni sensibili continuano a richiedere connettività, mentre le mutazioni offline supportate passano dall'outbox governata e dalla successiva sincronizzazione.

I contratti anti-regressione sono coperti da `test/deployment-recovery.test.js`, `test/offline-preload-contract.test.js`, dai test della session policy e dell'offline store.

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
npm run eval:plugin
npm run test:repo-radar
npm run test:randskills
npm run test:mind-learning
npm run test:security-intelligence
npm run test:randui
npm run test:e2e
npm run test:device
npm run test:lts
```

`npm test` include anche `test/openai-plugin-governance.test.js`, `test/rand-flow-policy.test.js`, `test/randai-rand-flow-ci-contract.test.js`, `test/randai-plugin-eval-adaptation.test.js`, `test/randradar-full-evolution-v1.test.js`, `test/randvisual-block2-sources.test.js`, `test/randarchitecture-block3.test.js`, `test/rand-foundations-group1.test.js` e `test/randui-navigation-actions-v2.test.js`; questi contratti proteggono intake plugin, RandFlow, permission gate/RandFocus, CI universale delle PR, single-evaluator policy, governance visuale/architetturale, inventario/capability e navigazione RandUI.
La CI certifica inoltre dependency/security audit, Quality Matrix, critical operational gate, multi-hotel parity, production confidence, build/bundle budget, contratti RandBrain/RandUI/RandAudio/Viking/RandAI/RandApp, Chromium + WebKit, device acceptance, RandCore health evidence e Rand Ecosystem LTS attestation. I workflow RandAI Group 1, Group 2 e Group 3 aggiungono rispettivamente tool authorization/evaluation, knowledge provenance/temporal boundary e durable lifecycle/resume.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

Produzione stabile: Vercel. Durante l'unificazione RandUI v1 i Git deploy Vercel restano congelati (`deploymentEnabled: false`); **prove e test grafici della nuova UI vanno esclusivamente su DigitalOcean/Ocean** finché non viene decisa esplicitamente la riattivazione.

## Documentazione

- `docs/architecture/RAND_OPENAI_PLUGINS_ADOPTION_V1.md` — intake governato OpenAI Plugins, ownership canonica e RandFlow.
- `docs/architecture/RAND_FOUNDATIONS_GROUP1.md` — consolidamento PI-Desktop/Superpowers/RandFocus, Permission Gate e anti-zombie.
- `docs/architecture/RAND_PLUGIN_EVAL_ADAPTATION_V1.md` — adapter `plugin-eval`, Fix First, evidence e before/after sopra Promptfoo/Quality Matrix.
- `docs/architecture/RANDRADAR_FULL_EVOLUTION_V1.md` — inventario vivo, scouting completo RandApp/RandAI, coverage fail-closed e governance.
- `docs/architecture/RANDSKILLS_V1.md` — formato skill e governance.
- `docs/architecture/RANDSKILLS_ROUTER_BLOCK1.md` — routing e tool bounding.
- `docs/architecture/RANDSKILLS_GOVERNANCE_BLOCK2.md` — lifecycle, overlap e zombie policy.
- `docs/architecture/RANDMIND_LEARNING_BLOCK2.md` — cognitive loop e learning verificato.
- `docs/architecture/RANDCORE_SECURITY_INTELLIGENCE_BLOCK3.md` — security intelligence e sandbox boundary.
- `docs/architecture/RANDAI_GROUP1_GUARDRAILS_OBSERVABILITY.md` — tool gateway, Promptfoo, OTLP/Phoenix e boundary ToolHive.
- `docs/architecture/RANDAI_GROUP2_KNOWLEDGE_MEMORY_RAG.md` — separazione Supabase/RandMind/Graph/RAG, provenance e temporal retrieval.
- `docs/architecture/RANDAI_GROUP3_DURABLE_RUNTIME.md` — lifecycle durevole, idempotenza, resume, reauthorization ed executor boundary.
- `docs/architecture/RANDVISUAL_BLOCK2.md` — RandVisual, sorgenti esterne governate, pipeline immagini e boundary RandUI.
- `docs/architecture/RANDARCHITECTURE_BLOCK3.md` — advisor system design evidence-based, source governance e anti-zombie policy.
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