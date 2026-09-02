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

## RandAI — roadmap canonica 1–20

La numerazione sotto è la sorgente canonica. Le precedenti denominazioni storiche a coppie non cambiano più i numeri della roadmap.

### Blocco 1 — Fondazione Core — 1–4 ✅

1. **Core / Orchestrator** — lifecycle dei task con transizioni terminali esplicite; un errore del registry porta il task a `FAILED` invece di lasciarlo zombie in `RUNNING`.
2. **Tool Registry** — capability discovery, rischio/permesso espliciti, health check, timeout, retry limitati e validazione fail-fast.
3. **Skill Engine** — lifecycle `DRAFT → CANDIDATE → TESTED → APPROVED`, progressive disclosure e accesso ai soli tool dichiarati.
4. **Directive Composer** — testo originale preservato, rules/forbidden/success criteria, versionamento e approvazione esplicita prima della promozione a skill candidata.

Il Blocco 1 è stato consolidato e mergiato tramite PR #118.

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

I Blocchi 2–4 sono stati consolidati insieme tramite PR #123, assorbendo il materiale valido di #119 e #122. La CI post-merge su `main` è risultata completamente verde; #120, #121 e #122 sono state poi chiuse come linee superseded/zombie.

### Blocco 5 — Valutazione, coordinamento e recovery — 17–20

17. **Evaluation / Benchmark 2.0** — grader e dimensioni validati, soglie `0..1`, suite non vuote e con scenario ID unici, scope `hotelId/projectId/taskId`, storico filtrabile per scope e confronto baseline/candidate con `regressed`, tolleranza e blocco dei confronti cross-scope.
18. **Multi-Agent 2.0** — registry con ID unici, ruoli/task/tool dichiarati validati, DAG senza cicli, limiti di agenti/concorrenza, tool richiesti come subset dell'allowlist dell'agente, scope hotel coerente, dipendenti terminalizzati dopo failure e telemetria non-fatal con self-diagnostic.
19. **Permission / Autonomy 2.0** — livelli L0–L4 e risk/permission continuano a governare le azioni; le policy contraddittorie vengono rifiutate, TTL approval validato e l'identità di una approval è deterministica e include lo scope. Un'approvazione di Hotel Giò non può autorizzare Chocohotel; DurableTaskRunner propaga lo scope hotel anche ai rollback.
20. **Recovery / Self-Correction 2.0** — classificazione failure, retry same strategy, switch strategy, rollback autorizzato, escalation umana e stop; budget e fingerprint anti-loop sono validati fail-fast, safety/permission non vengono ritentati automaticamente e le recovery decision conservano lo scope hotel. La self-correction resta dentro DurableTaskRunner/Verifier/Autonomy e non crea un secondo runtime.

Sorgenti canoniche: `src/randai/evals/`, `agents/`, `autonomy/`, `recovery/`, integrate con `runtime/`.

Test di consolidamento Blocco 5: `test/randai-block5-17-20.test.js`, oltre a `test/randai-evals-multi-agent.test.js` e `test/randai-autonomy-recovery.test.js`.

## Runtime Safety Layer — trasversale, non rinumerato

Questi requisiti valgono per più blocchi:

- **Identity/Auth:** `/randai` richiede sessione Supabase + membership autorizzata; niente credenziali prevedibili precompilate.
- **Multi-Agent:** limiti e DAG validati; nessun run concluso lascia task `PENDING`; tool e scope sono verificati prima dell'invocazione.
- **Permission/Autonomy:** approval legate all'identità esatta dell'azione e allo scope; critical/admin richiedono sempre il controllo umano previsto.
- **Hotel isolation:** scope esplicito su conoscenza, memoria, contesto, guidance, gap, approval e recovery operative.
- **Fail closed:** assenza di dati, verifier, permessi, contesto o conoscenza non produce una risposta operativa inventata.
- **Recovery bounded:** nessun retry infinito; repeated fingerprint e budget esaurito fermano il ciclo.

## Consolidamento storico

- PR #118: Blocco 1.
- PR #123: consolidamento canonico 1–16 e assorbimento delle parti valide di #119/#122.
- #120, #121 e #122: chiuse come superseded dopo la #123.
- Branch `randai/block5-17-20`: consolidamento canonico dei punti 17–20; deve essere mergiata solo con CI completa verde.

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

Dopo la chiusura verificata del Blocco 5, la roadmap storica continua con:

21. **Software Engineering Agent**;
22. **Learning Engine**;
23. **Skill / Tool Discovery**;
24. **RandAI Supervisor**;
25. **Proactive RandAI**;
26. **Control Center**.

I moduli già presenti per alcuni punti successivi non vengono considerati automaticamente completi: saranno riesaminati con lo stesso criterio di consolidamento, zombie scan e CI completa usato per 1–20.

## RandApp

Funzioni principali:

- Segnalazioni, foto, storico, priorità, presa in carico e completamento;
- Interventi, Planning Lavori e Planning Sale;
- Housekeeping e Rifornimenti interni;
- notifiche push/ntfy, meteo operativo, sensori e impianti;
- Magazzino autonomo collegato agli interventi tramite movimenti/ledger;
- offline/outbox IndexedDB, retry controllato, diagnostica e audit;
- shell responsive per iOS, Android e Windows.

Il pulsante `+` usa il router contestuale della shell: una singola azione viene aperta direttamente, più azioni aprono il launcher.

### Hotel Giò — camere

- **Jazz:** numerazione a 4 cifre, per esempio `1101`, `1114`;
- **Wine:** numerazione a 3 cifre, per esempio `201`, `214`.

## Magazzino

Dominio autonomo ma collegato a RandApp. La fonte storica è il ledger dei movimenti; le giacenze sono saldi derivati/materializzati. Supporta catalogo, categorie/ubicazioni, QR/barcode, seriali, compatibilità, inventario fisico, trasferimenti e ricambi associati agli interventi. Un intervento non deve modificare silenziosamente la giacenza: il consumo deve produrre un movimento tracciato.

## Struttura repository

- `src/main.jsx` — entry;
- `src/randapp/` — shell/UI e domini RandApp;
- `src/randai/core/`, `tools/`, `skills/`, `directives/` — Blocco 1;
- `src/randai/maintenance/`, `runtime/` — Blocco 2;
- `src/randai/memory/`, `context/`, `models/`, `gaps/` — Blocco 3;
- `src/randai/guidance/`, `projects/`, `observability/` — Blocco 4;
- `src/randai/evals/`, `agents/`, `autonomy/`, `recovery/` — Blocco 5;
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
