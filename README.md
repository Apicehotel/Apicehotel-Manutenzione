# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di **Hotel Giò**, **Chocohotel** e **Hotel Il Brigantino**.

## Stato e principi

RandApp usa un unico progetto Supabase multi-hotel. La separazione dei dati è basata su `hotel_id`, membership, RLS/RPC, vincoli relazionali e test cross-hotel. L'autenticazione applicativa resta server-side e le operazioni privilegiate non devono essere autorizzate dalla sola UI.

Piattaforme target: **iOS/iPadOS, Android e Windows**.

Regole architetturali:

- Supabase/RandApp restano il system of record;
- RandAI riceve solo contesto autorizzato e hotel-scoped;
- nessun modello riceve `service_role`, PIN, refresh token o secret non necessari;
- le scritture operative RandAI passano da tool/Action Gateway controllati;
- output AI e telemetria non equivalgono a verità operativa finché non sono verificati;
- niente implementazioni parallele per la stessa responsabilità;
- una parte viene eliminata come zombie solo con evidenza che è inutilizzata, irraggiungibile o sostituita da una sorgente canonica migliore;
- **se esiste una soluzione nettamente migliore, si sostituisce la debolezza invece di accumulare patch**.

## RandAI — roadmap originale 1–26 ✅

La roadmap originale RandAI è consolidata da 1 a 26. La numerazione sotto è la sorgente canonica; le precedenti denominazioni storiche a coppie non cambiano più i numeri.

### Blocco 1 — Fondazione Core — 1–4 ✅

1. **Core / Orchestrator** — lifecycle dei task con transizioni terminali esplicite; un errore del registry porta il task a `FAILED` invece di lasciarlo zombie in `RUNNING`.
2. **Tool Registry** — capability discovery, rischio/permesso espliciti, health check, timeout, retry limitati e validazione fail-fast.
3. **Skill Engine** — lifecycle `DRAFT → CANDIDATE → TESTED → APPROVED`, progressive disclosure e accesso ai soli tool dichiarati.
4. **Directive Composer** — testo originale preservato, rules/forbidden/success criteria, versionamento e approvazione esplicita prima della promozione a skill candidata.

### Blocco 2 — Motore operativo — 5–8 ✅

5. **Maintenance Knowledge Engine** — procedure, impianti, relazioni, evidenze e revisioni con provenienza/trust; operazioni sensibili hotel-scoped e chiavi composite `hotelId + id`.
6. **Procedure Assistant** — produce proposte `DRAFT`, conserva testo/evidenze, rileva campi mancanti e preserva lo scope hotel fino all'approvazione.
7. **Planner → Executor → Verifier** — piano validato prima dell'esecuzione; niente cicli, auto-dipendenze o strategie senza tool; un tool riuscito non equivale a successo finché il verifier non passa.
8. **Durable Tasks / Checkpoint** — checkpoint, revisioni ottimistiche, lease, idempotency key, resume/pause, riconciliazione delle interruzioni e cancellazione persistente sicura.

### Blocco 3 — Memoria, contesto e routing — 9–12 ✅

9. **Scoped Memory Engine** — recall/dedup con scope esplicito (`hotelId`, `projectId`, `taskId` o `global`).
10. **Authorized Context Engine** — contesto da sole evidenze autorizzate, budget positivo, provenance e nessun widening implicito.
11. **Model Router** — provider-agnostic, descriptor/capability/privacy/context/metriche validate, fallback bounded e tracciabile.
12. **Knowledge Gaps** — registra ciò che manca invece di inventare; gap manutentivi hotel-scoped, deduplicati e risolvibili solo con approvazione + provenance.

### Blocco 4 — Intelligenza operativa e osservabilità — 13–16 ✅

13. **Smart Maintenance Suggestions 2.0** — procedure `APPROVED/VERIFIED` prevalgono sui casi precedenti; le esperienze restano non-actionable finché non validate.
14. **Guided Procedures 2.0** — branching/`stopOn` validati, niente step zombie o grafi senza terminale raggiungibile, sessioni hotel-scoped.
15. **Project Intelligence 2.0** — grafo di file/moduli/database/workflow/test e relazioni semantiche senza archi duplicati.
16. **Observability 2.0** — trace/span/event e lifecycle coerenti, niente successo con span aperti, progress validi e self-diagnostics non-fatal.

### Blocco 5 — Valutazione, coordinamento e recovery — 17–20 ✅

17. **Evaluation / Benchmark 2.0** — grader/dimensioni/soglie validati, suite non vuote, scope `hotelId/projectId/taskId`, confronto baseline/candidate e regression detection cross-scope safe.
18. **Multi-Agent 2.0** — registry con ID unici, DAG validato, agent/tool allowlist, limiti di concorrenza, scope hotel e telemetria non-fatal.
19. **Permission / Autonomy 2.0** — approval identity deterministica e scope-aware; policy contraddittorie e TTL invalidi falliscono; una approval di Hotel Giò non autorizza Chocohotel.
20. **Recovery / Self-Correction 2.0** — retry/switch/rollback/escalation con budget e fingerprint anti-loop; safety/permission non vengono ritentati automaticamente.

### Blocco 6 — Engineering, learning, discovery e supervisor — 21–24 ✅

21. **Software Engineering Agent 2.0** — impact analysis prima dell'esecuzione, target unici, scope hotel propagato a task/review/evaluation, DurableTaskRunner come unica via di esecuzione, verifier/review/eval prima del successo e osservabilità non-fatal.
22. **Learning Engine 2.0** — apprende soltanto esperienze `verified`, richiede evidenza ripetuta, promuove automaticamente al massimo fino a `TESTED` e mai `APPROVED`; `minEvidence` e scope hotel sono validati.
23. **Skill / Tool Discovery 2.0** — discovery multi-source senza installazione automatica; source/candidate ID duplicati rifiutati, licenza/rischio/reputation validati, sandbox prima dell'evaluation e score utility/security finiti `0..1`.
24. **RandAI Supervisor 2.0** — sceglie single/multi-agent da piani espliciti, governa budget/quality gate, mantiene run e anti-loop hotel-scoped, valida metriche e tratta la telemetria come non-fatal. Metriche non finite come `NaN` non possono aggirare i budget gate.

### Blocco 7 — Proattività e Control Center — 25–26 ✅

25. **Proactive RandAI 2.0** — ogni segnale appartiene a un hotel oppure a uno scope globale esplicito; dedupe/fingerprint sono isolati per hotel, process/resolve falliscono su scope mancante o errato e le azioni passano dal Supervisor.
26. **Control Center 2.0** — proiezione read-only sugli store autorevoli, mai seconda sorgente di verità. Ogni snapshot richiede `hotelId` oppure `allHotels:true`; la vista hotel applica un filtro difensivo anche se uno store sottostante ignora i filtri.

## RandAI — estensione Reliability

La roadmap originale 1–26 resta chiusa e non viene rinumerata. I blocchi successivi sono estensioni evolutive distinte.

### Blocco 8 — Operational Safety Foundation — 27–30 ✅

27. **Operational Context Layer 2.0** — RandApp pubblica un envelope operativo versionato con hotel, actor locale, schermata e risorsa autorizzata. Il server risanifica il contesto, non si fida dell'actor proveniente dal client e rifiuta versioni/source non supportati. Il dominio operativo attualmente verificato end-to-end è `issue`; nuovi tipi di risorsa vanno aggiunti solo insieme alla verifica server corrispondente.
28. **Context & Scope Guard 2.0** — il guard condiviso verifica hotel, source, versione, modulo, risorsa, actor quando richiesto, permessi e ownership. Per le azioni RandAI `screen.view` e resource type/id sono obbligatori: un contesto incompleto non viene interpretato come autorizzazione.
29. **Unified Validation Layer 2.0** — `validation-engine.js` resta il motore generico e `domain-validation.js` lo compone per i domini. L'Action Gateway usa lo stesso motore per il preflight di `prepare/execute`, evitando validazioni parallele e divergenti.
30. **Safe Write Engine / Action Gateway 2.0** — il server `prepare` è fail-closed e richiede contesto esatto `hotel + randapp/v1 + issues + issue/id`; membership e permission vengono ricontrollate server-side; l'identità idempotente usa serializzazione deterministica; execute mantiene approval actor/hotel-scoped, expiry, optimistic version fence, post-write verification e audit. Ogni esecuzione/replay verificato produce una receipt con approval, idempotency key, resource, timestamp e stato audit.

Sorgenti canoniche Blocco 8:

- `src/randai/context/envelope.js` — envelope operativo client;
- `supabase/functions/_shared/randai-operational-context.js` — sanitizer/normalizzazione server;
- `src/reliability/context-scope-guard.js` — scope guard condiviso;
- `src/reliability/validation-engine.js` + `domain-validation.js` — validazione generica + composizione di dominio;
- `src/reliability/safe-write-engine.js` — primitiva generica di write verificata;
- `src/randai/action-gateway.js` + `supabase/functions/randai-action-gateway/` — adapter e boundary operativo RandAI.

Questi file non sono doppioni zombie: client/server, primitive generiche e boundary RandAI hanno responsabilità diverse. Non è stata aggiunta alcuna dipendenza esterna o nuova migrazione perché il percorso esistente era già più integrato e sicuro di un framework aggiuntivo.

Test dedicato: `test/randai-block8-27-30.test.js`, insieme ai contratti reliability e Action Gateway esistenti.

## Runtime Safety Layer — trasversale

- **Identity/Auth:** `/randai` richiede sessione Supabase + membership autorizzata; niente credenziali prevedibili.
- **Hotel isolation:** scope esplicito su conoscenza, memoria, contesto, guidance, gap, approval, recovery, learning, supervisor, segnali proattivi, Control Center e write operative.
- **Operational context:** source/version/module/resource sono verificati ai boundary sensibili; il client non può auto-certificare la propria identità al server.
- **Permission/Autonomy:** critical/admin passano sempre dai controlli previsti; approval legate all'azione esatta e allo scope.
- **Unified validation:** i domini compongono lo stesso motore di validazione condiviso invece di introdurre controlli incompatibili.
- **Safe writes:** approval + idempotenza + optimistic version fence + read-back verification + receipt/audit per l'Action Gateway.
- **Verification:** nessun tool call, software change o esperienza diventa verità/successo soltanto perché l'esecuzione tecnica è terminata.
- **Recovery bounded:** niente retry infinito; fingerprint ripetuti e budget esauriti fermano il ciclo.
- **Telemetry non-fatal:** un guasto di log/telemetria viene diagnosticato ma non riscrive l'esito operativo.
- **External discovery:** una repository/skill/tool candidata resta candidata; assessment, sandbox ed evaluation non autorizzano da soli installazione o esecuzione.
- **Explicit global scope:** eventi globali reali devono dichiararlo; l'assenza di `hotelId` non equivale automaticamente a globale.

## Consolidamento storico

- PR #118: Blocco 1.
- PR #123: consolidamento canonico 1–16 e assorbimento delle parti valide di #119/#122.
- #120, #121 e #122: chiuse come superseded/zombie dopo la #123.
- PR #124: consolidamento canonico 17–20.
- PR #125: consolidamento canonico 21–24.
- PR #126: consolidamento canonico 25–26 e chiusura della roadmap originale 1–26, verificata anche su `main`.
- PR #127: consolidamento Reliability 27–30; codice e test dedicati hanno superato audit, quality, multi-hotel, RandAI/shared e browser/device prima della marcatura finale del blocco.

## CI e quality gates

La CI esegue dependency security audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, build, bundle budget, contratti RandAI, contratti RandApp/shared, Playwright Chromium/WebKit, cross-platform browser e device acceptance. Le partizioni dei contratti eseguono i file singolarmente e producono diagnostica completa senza rendere il gate più permissivo.

## RandAI Control Center

Route protetta: `/randai`.

La console centralizza Overview, WhatsApp, Segnalazioni, Tecnici, Worker, Log, Manutenzioni, Conoscenze, Bozze/Approvazioni, Impianti, Scadenze, Regole, Anomalie, Costi/Osservabilità, Media/Drive e Sensori. UI e console non sostituiscono RLS/RPC/Action Gateway. Il motore `control-center/` resta una proiezione read-only e le viste cross-hotel devono essere richieste esplicitamente.

Canali WhatsApp configurati:

- Hotel Giò: `+390759978247`;
- Chocohotel: `+390759970610`;
- Brigantino: nessun numero configurato.

## Stato roadmap RandAI

- **Roadmap originale 1–26: completa ✅**
- **Estensione Reliability Blocco 8, 27–30: completa ✅**

Le estensioni successive restano separate e devono essere riesaminate con lo stesso criterio: nessun numero viene dichiarato completo per inferenza o perché esiste già codice storico.

## RandApp

Funzioni principali:

- Segnalazioni, foto, storico, priorità, presa in carico e completamento;
- Interventi, Planning Lavori e Planning Sale;
- Housekeeping e Rifornimenti interni;
- notifiche push/ntfy, meteo operativo, sensori e impianti;
- Magazzino autonomo collegato agli interventi tramite movimenti/ledger;
- offline/outbox IndexedDB, retry controllato, diagnostica e audit;
- shell responsive per iOS, Android e Windows.

### Hotel Giò — camere

- **Jazz:** numerazione a 4 cifre, per esempio `1101`, `1114`;
- **Wine:** numerazione a 3 cifre, per esempio `201`, `214`.

## Magazzino

Dominio autonomo ma collegato a RandApp. La fonte storica è il ledger dei movimenti; le giacenze sono saldi derivati/materializzati. Un intervento non deve modificare silenziosamente la giacenza: il consumo deve produrre un movimento tracciato.

## Struttura repository

- `src/main.jsx` — entry;
- `src/randapp/` — shell/UI e domini RandApp;
- `src/randai/core/`, `tools/`, `skills/`, `directives/` — Blocco 1;
- `src/randai/maintenance/`, `runtime/` — Blocco 2;
- `src/randai/memory/`, `context/`, `models/`, `gaps/` — Blocco 3 e Operational Context;
- `src/randai/guidance/`, `projects/`, `observability/` — Blocco 4;
- `src/randai/evals/`, `agents/`, `autonomy/`, `recovery/` — Blocco 5;
- `src/randai/software/`, `learning/`, `discovery/`, `supervisor/` — Blocco 6;
- `src/randai/proactive/`, `control-center/` — Blocco 7;
- `src/randai/action-gateway.js` — adapter Safe Write RandAI;
- `src/randai/control/` — UI e console operative RandAI;
- `src/reliability/` — reliability/safety condivisa, inclusi scope, validation e safe-write;
- `supabase/functions/` — Edge Functions e boundary server;
- `supabase/migrations/` — migrazioni;
- `test/` e `scripts/` — contratti, quality gates ed E2E.

## Regola di chiusura

Un blocco non è ✅ perché esiste il codice. È chiuso solo quando:

- implementazione canonica unica o layer distinti giustificati;
- isolamento multi-hotel verificato;
- integrazione con i blocchi adiacenti verificata;
- test dedicati verdi;
- RandApp/shared contracts verdi;
- CI completa e browser/device gates verdi;
- scan zombie completato e README coerente;
- merge finale eseguito senza forzare `main`.
