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

## RandAI — roadmap canonica 1–24

La numerazione sotto è la sorgente canonica. Le precedenti denominazioni storiche a coppie non cambiano più i numeri della roadmap.

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

### Blocco 6 — Engineering, learning, discovery e supervisor — 21–24

21. **Software Engineering Agent 2.0** — impact analysis prima dell'esecuzione, target unici, scope hotel propagato a task/review/evaluation, DurableTaskRunner come unica via di esecuzione, verifier/review/eval prima del successo e osservabilità non-fatal. Un impatto esplicitamente appartenente a un altro hotel viene rifiutato.
22. **Learning Engine 2.0** — apprende soltanto esperienze `verified`, richiede evidenza ripetuta, promuove automaticamente al massimo fino a `TESTED` e mai `APPROVED`; `minEvidence` è validato e propose/evaluate di candidati hotel-scoped falliscono senza lo stesso `hotelId`.
23. **Skill / Tool Discovery 2.0** — discovery multi-source senza installazione automatica; source ID e candidate ID duplicati vengono rifiutati, licenza/rischio/reputation sono validati, sandbox obbligatoria prima dell'evaluation e score utility/security devono essere finiti `0..1`. La raccomandazione non equivale a installazione.
24. **RandAI Supervisor 2.0** — sceglie single/multi-agent solo da piani espliciti, governa budget e quality gate, mantiene run e anti-loop hotel-scoped, valida metriche e soglie, usa Discovery per capability gap e tratta la telemetria come non-fatal con self-diagnostic.

Sorgenti canoniche Blocco 6: `src/randai/software/`, `learning/`, `discovery/`, `supervisor/`. Non sono implementazioni duplicate: Software Engineering esegue cambi verificati, Learning trasforma evidenza in candidati, Discovery valuta capacità esterne e Supervisor coordina i motori.

Test dedicato: `test/randai-block6-21-24.test.js`, oltre ai contratti storici `randai-software-learning.test.js` e `randai-discovery-supervisor.test.js`.

## Runtime Safety Layer — trasversale

- **Identity/Auth:** `/randai` richiede sessione Supabase + membership autorizzata; niente credenziali prevedibili.
- **Hotel isolation:** scope esplicito su conoscenza, memoria, contesto, guidance, gap, approval, recovery, learning e supervisor.
- **Permission/Autonomy:** critical/admin passano sempre dai controlli previsti; approval legate all'azione esatta e allo scope.
- **Verification:** nessun tool call, software change o esperienza diventa verità/successo soltanto perché l'esecuzione tecnica è terminata.
- **Recovery bounded:** niente retry infinito; fingerprint ripetuti e budget esauriti fermano il ciclo.
- **Telemetry non-fatal:** un guasto di log/telemetria viene diagnosticato ma non riscrive l'esito operativo.
- **External discovery:** una repository/skill/tool candidata resta candidata; assessment, sandbox ed evaluation non autorizzano da soli installazione o esecuzione.

## Consolidamento storico

- PR #118: Blocco 1.
- PR #123: consolidamento canonico 1–16 e assorbimento delle parti valide di #119/#122.
- #120, #121 e #122: chiuse come superseded/zombie dopo la #123.
- PR #124: consolidamento canonico 17–20, mergiato solo dopo CI completa verde e nuovamente verde su `main`.
- Branch `randai/block6-21-24`: consolidamento canonico 21–24; deve essere mergiato solo dopo CI completa verde sulla revisione finale.

## CI e quality gates

La CI esegue dependency security audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, build, bundle budget, contratti RandAI, contratti RandApp/shared, Playwright Chromium/WebKit, cross-platform browser e device acceptance. Le partizioni dei contratti eseguono i file singolarmente e producono diagnostica completa senza rendere il gate più permissivo.

## RandAI Control Center

Route protetta: `/randai`.

La console centralizza Overview, WhatsApp, Segnalazioni, Tecnici, Worker, Log, Manutenzioni, Conoscenze, Bozze/Approvazioni, Impianti, Scadenze, Regole, Anomalie, Costi/Osservabilità, Media/Drive e Sensori. UI e console non sostituiscono RLS/RPC/Action Gateway.

Canali WhatsApp configurati:

- Hotel Giò: `+390759978247`;
- Chocohotel: `+390759970610`;
- Brigantino: nessun numero configurato.

## Prossimi punti RandAI

Dopo la chiusura verificata del Blocco 6 restano gli ultimi punti della roadmap storica:

25. **Proactive RandAI**;
26. **Control Center**.

I moduli già presenti per 25–26 non vengono considerati automaticamente completi: saranno riesaminati con lo stesso criterio di consolidamento, zombie scan e CI completa usato per 1–24.

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
- `src/randai/memory/`, `context/`, `models/`, `gaps/` — Blocco 3;
- `src/randai/guidance/`, `projects/`, `observability/` — Blocco 4;
- `src/randai/evals/`, `agents/`, `autonomy/`, `recovery/` — Blocco 5;
- `src/randai/software/`, `learning/`, `discovery/`, `supervisor/` — Blocco 6;
- `src/randai/control/`, `control-center/` — console e proiezioni operative;
- `src/reliability/` — reliability/safety condivisa;
- `supabase/functions/` — Edge Functions;
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
