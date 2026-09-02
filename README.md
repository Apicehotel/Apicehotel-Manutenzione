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

## RandAI — roadmap canonica originale 1–26 ✅

La roadmap originale RandAI è consolidata da 1 a 26 su `main`.

### Blocchi originali chiusi

1. **Blocco 1 — 1–4 ✅** Core / Orchestrator, Tool Registry, Skill Engine, Directive Composer.
2. **Blocco 2 — 5–8 ✅** Maintenance Knowledge, Procedure Assistant, Planner→Executor→Verifier, Durable Tasks.
3. **Blocco 3 — 9–12 ✅** Scoped Memory, Authorized Context, Model Router, Knowledge Gaps.
4. **Blocco 4 — 13–16 ✅** Smart Maintenance Suggestions, Guided Procedures, Project Intelligence, Observability.
5. **Blocco 5 — 17–20 ✅** Evaluation/Benchmark, Multi-Agent, Permission/Autonomy, Recovery/Self-Correction.
6. **Blocco 6 — 21–24 ✅** Software Engineering Agent, Learning Engine, Skill/Tool Discovery, RandAI Supervisor.
7. **Blocco 7 — 25–26 ✅** Proactive RandAI e Control Center read-only, entrambi scope-safe multi-hotel/global.

## Roadmap evolutiva — Reliability / Production

La roadmap evolutiva continua dopo la 1–26 senza riscrivere la numerazione storica.

### Blocco 8 — Reliability Foundation — 27–30 ✅

27. **Operational Context Layer** — contratto canonico `src/reliability/operational-context.js`: ogni contesto dichiara esattamente uno scope (`hotelId` oppure `global:true`); i contesti hotel richiedono un attore, le risorse non possono appartenere a un altro hotel, permissions/evidence/attachments sono strutturati e non esiste widening implicito.
28. **Context & Scope Guard** — `src/reliability/context-scope-guard.js` resta il guard canonico condiviso: verifica hotel, attore, modulo, risorsa, permission e ownership e fallisce chiuso sui mismatch.
29. **Unified Validation Layer** — `src/reliability/validation-engine.js` + validazioni dominio sono il layer canonico; Action Gateway non può eseguire una mutazione se il validation result contiene errori.
30. **Safe Write Engine / Action Gateway** — `safe-write-engine.js` conserva preflight → idempotency lookup → write → read-back → verify senza retry nascosti; `action-gateway.js` aggiunge authorization, scope guard, validation, blocco delle write globali e receipt/audit hotel-scoped.

Test dedicato: `test/randai-block8-reliability-27-30.test.js`.

### Decisione architetturale Blocco 8

Non sono stati creati duplicati di Scope Guard, Validation Engine o Safe Write Engine: erano già componenti vivi in `src/reliability/` e sono stati mantenuti come sorgenti canoniche. Il nuovo Operational Context normalizza il confine RandApp→RandAI/reliability; il nuovo Action Gateway compone i componenti esistenti invece di creare una seconda pipeline di sicurezza.

`src/randai/context/` non è zombie: gestisce il context/memory AI e il bridge UI. `src/reliability/operational-context.js` ha una responsabilità diversa: rappresenta il contesto autorizzativo/operativo usato prima di azioni e scritture. Non vanno fusi finché hanno questi confini distinti.

## Runtime Safety Layer — trasversale

- **Identity/Auth:** `/randai` richiede sessione Supabase + membership autorizzata; niente credenziali prevedibili.
- **Hotel isolation:** scope esplicito su conoscenza, memoria, contesto, guidance, gap, approval, recovery, learning, supervisor, segnali proattivi, Control Center e Operational Context.
- **Permission/Autonomy:** critical/admin passano sempre dai controlli previsti; approval legate all'azione esatta e allo scope.
- **Validation:** input e mutazioni operative non possono aggirare i validation result canonici.
- **Safe writes:** authorize → scope → validate → idempotency → write → read-back → verify → receipt/audit.
- **Verification:** nessun tool call, software change o esperienza diventa verità/successo soltanto perché l'esecuzione tecnica è terminata.
- **Recovery bounded:** niente retry infinito; fingerprint ripetuti e budget esauriti fermano il ciclo.
- **Telemetry non-fatal:** un guasto di log/telemetria viene diagnosticato ma non riscrive l'esito operativo.
- **External discovery:** una repository/skill/tool candidata resta candidata; assessment, sandbox ed evaluation non autorizzano da soli installazione o esecuzione.
- **Explicit global scope:** eventi globali reali devono dichiararlo; le write operative restano hotel-scoped.

## Consolidamento storico

- PR #118: Blocco 1.
- PR #123: consolidamento canonico 1–16 e assorbimento delle parti valide di #119/#122.
- #120, #121 e #122: chiuse come superseded/zombie dopo la #123.
- PR #124: consolidamento canonico 17–20.
- PR #125: consolidamento canonico 21–24.
- PR #126: consolidamento canonico 25–26; CI completa verde sulla PR e nuovamente verde su `main`.
- PR #128: Blocco 8 Reliability Foundation 27–30; merge consentito solo con CI finale e post-merge verdi.

## CI e quality gates

La CI esegue dependency security audit, Quality Matrix, Critical Operational Gate, multi-hotel parity, build, bundle budget, contratti RandAI, contratti RandApp/shared, Playwright Chromium/WebKit, cross-platform browser e device acceptance. Le partizioni dei contratti eseguono i file singolarmente e producono diagnostica completa senza rendere il gate più permissivo.

## RandAI Control Center

Route protetta: `/randai`. La console centralizza Overview, WhatsApp, Segnalazioni, Tecnici, Worker, Log, Manutenzioni, Conoscenze, Bozze/Approvazioni, Impianti, Scadenze, Regole, Anomalie, Costi/Osservabilità, Media/Drive e Sensori. UI e console non sostituiscono RLS/RPC/Action Gateway.

Canali WhatsApp configurati:

- Hotel Giò: `+390759978247`;
- Chocohotel: `+390759970610`;
- Brigantino: nessun numero configurato.

## RandApp

Funzioni principali: Segnalazioni; Interventi; Planning Lavori/Sale; Housekeeping; Rifornimenti; notifiche push/ntfy; meteo; sensori; Magazzino; offline/outbox; diagnostica e audit; shell iOS/Android/Windows.

### Hotel Giò — camere

- **Jazz:** numerazione a 4 cifre, per esempio `1101`, `1114`;
- **Wine:** numerazione a 3 cifre, per esempio `201`, `214`.

## Magazzino

Dominio autonomo ma collegato a RandApp. La fonte storica è il ledger dei movimenti; le giacenze sono saldi derivati/materializzati. Un intervento non deve modificare silenziosamente la giacenza: il consumo deve produrre un movimento tracciato.

## Struttura repository

- `src/main.jsx` — entry;
- `src/randapp/` — shell/UI e domini RandApp;
- `src/randai/` — motori RandAI 1–26;
- `src/reliability/` — reliability/safety condivisa e Blocco 8;
- `supabase/functions/` — Edge Functions;
- `supabase/migrations/` — migrazioni;
- `test/` e `scripts/` — contratti, quality gates ed E2E.

## Regola di chiusura

Un blocco non è ✅ perché esiste il codice. È chiuso solo quando: implementazione canonica unica o layer distinti giustificati; isolamento multi-hotel; integrazione; test dedicati; RandApp/shared contracts; CI completa e browser/device; zombie scan; README coerente; merge senza forzare `main`; CI post-merge verde.
