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
- niente implementazioni parallele per la stessa responsabilità: il codice duplicato viene mantenuto solo se rappresenta un layer distinto e referenziato;
- una parte viene eliminata come zombie solo con evidenza che è inutilizzata, irraggiungibile o sostituita da una sorgente canonica migliore;
- **se esiste una soluzione nettamente migliore, si preferisce sostituire la debolezza invece di accumulare patch**.

## RandAI — roadmap canonica 1–16

La numerazione sotto è la sorgente canonica. Le precedenti denominazioni storiche a coppie non cambiano più i numeri della roadmap.

### Blocco 1 — Fondazione Core — 1–4 ✅

1. **Core / Orchestrator** — lifecycle dei task con transizioni terminali esplicite; un errore del registry porta il task a `FAILED` invece di lasciarlo zombie in `RUNNING`.
2. **Tool Registry** — capability discovery, rischio/permesso espliciti, health check, timeout, retry limitati e validazione fail-fast.
3. **Skill Engine** — lifecycle `DRAFT → CANDIDATE → TESTED → APPROVED`, progressive disclosure e accesso ai soli tool dichiarati.
4. **Directive Composer** — testo originale preservato, rules/forbidden/success criteria, versionamento e approvazione esplicita prima della promozione a skill candidata.

Il Blocco 1 è stato consolidato e mergiato tramite PR #118.

### Blocco 2 — Motore operativo — 5–8

5. **Maintenance Knowledge Engine** — procedure, impianti, relazioni, evidenze e revisioni con provenienza/trust. Tutte le operazioni sensibili sono hotel-scoped. Procedure e impianti usano chiavi composite `hotelId + id`, così lo stesso ID può esistere in strutture diverse senza collisioni. Draft e conoscenza non verificata non diventano fatti operativi.
6. **Procedure Assistant** — trasforma il testo fornito dallo staff in una proposta `DRAFT`, conserva testo/evidenze, rileva campi mancanti e richiede approvazione umana. Lo scope hotel viene preservato fino all'approvazione finale e non può essere cambiato silenziosamente.
7. **Planner → Executor → Verifier** — il piano viene validato prima dell'esecuzione; ID e dipendenze devono essere coerenti, non sono ammessi grafi ciclici, auto-dipendenze o strategie senza tool. Il risultato di un tool non equivale a successo: la verifica deve passare prima che lo step diventi `SUCCEEDED`.
8. **Durable Tasks / Checkpoint** — task persistenti, checkpoint, revisioni ottimistiche, lease, idempotency key per gli effetti, resume, pause e riconciliazione obbligatoria dopo interruzioni in `RUNNING/VERIFYING`. La cancellazione usa un controllo dedicato con lease e non può dichiarare cancellato un effetto ancora incerto.

Sorgenti principali: `src/randai/maintenance/` e `src/randai/runtime/`.

Test di consolidamento: `test/randai-block2-consolidation.test.js`, `test/randai-maintenance-knowledge.test.js`.

### Blocco 3 — Memoria, contesto e routing — 9–12

9. **Scoped Memory Engine** — recall/dedup richiedono uno scope esplicito (`hotelId`, `projectId`, `taskId` o `global` dichiarato). Nessuna query senza scope equivale a leggere tutte le memorie.
10. **Authorized Context Engine** — costruisce il contesto solo da evidenze autorizzate, con budget positivo, provenance e nessun widening implicito dello scope.
11. **Model Router** — provider-agnostic; valida descriptor, capability, privacy, context window e metriche; rifiuta ID duplicati e fallback illimitati; seleziona/fallback in modo bounded e tracciabile.
12. **Knowledge Gaps** — quando manca conoscenza verificata RandAI registra un gap invece di inventare. I gap manutentivi richiedono `hotelId` anche per lettura/modifica/risoluzione, deduplicano le domande equivalenti e richiedono approvazione + provenance per diventare risolti.

L'hardening di Memory, Context e Model Router proviene dalla PR #119 ed è stato assorbito nella linea di consolidamento #123.

### Blocco 4 — Intelligenza operativa e osservabilità — 13–16

13. **Smart Maintenance Suggestions 2.0** — combina conoscenza verificata e memoria pertinente senza confonderne il livello di fiducia. Una procedura `APPROVED/VERIFIED` ha priorità operativa sui casi precedenti; le esperienze restano non-actionable finché non vengono validate.
14. **Guided Procedures 2.0** — branching e `stopOn` validati, riferimenti a step verificati, rifiuto degli step irraggiungibili/zombie e dei grafi senza terminale raggiungibile; sessioni di guida leggibili/modificabili nello scope hotel corretto.
15. **Project Intelligence 2.0** — grafo di file/moduli/database/workflow/test e relazioni semantiche; archi duplicati vengono rifiutati per evitare impatti/dipendenze conteggiati più volte.
16. **Observability 2.0** — trace/span/event validati, lifecycle coerente, nessun `SUCCEEDED` con span ancora aperti, progress weights validi e self-diagnostics per errori di telemetria. Un errore dell'instrumentation non deve rompere l'operazione principale, ma non viene nascosto.

L'hardening 13–16 proviene dalla PR #122 ed è stato assorbito selettivamente nella linea di consolidamento #123 senza duplicare i motori esistenti.

Test di consolidamento: `test/randai-block4-hardening.test.js`, `test/randai-smart-maintenance-guidance.test.js`.

## Runtime Safety Layer — trasversale, non rinumerato

Questi requisiti valgono per più blocchi e **non sostituiscono i punti 5–16**:

- **Identity/Auth:** console `/randai` vincolata a sessione Supabase + membership autorizzata; niente credenziali prevedibili precompilate o password iniziali proposte dal client.
- **Multi-Agent:** limiti di agenti/concorrenza validati, ID unici, riferimenti alle dipendenze validi, grafi ciclici rifiutati prima dell'esecuzione; dopo un failure i dipendenti vengono terminalizzati e nessun run concluso lascia task `PENDING`.
- **Hotel isolation:** scope esplicito su conoscenza, memoria, contesto, guidance e gap manutentivi; nessun recupero cross-hotel per semplice conoscenza di un ID.
- **Fail closed:** assenza di dati, verifier, permessi, contesto o conoscenza non produce una risposta operativa inventata.

## Consolidamento #119 / #122 → #123

La PR **#123 — RandAI 1–16 consolidation foundation** è la linea di integrazione canonica.

- #119 è stata assorbita nella branch di consolidamento per Auth, Model Router, Memory/Context e Multi-Agent hardening;
- #122 è stata assorbita selettivamente per i punti 13–16; il suo README storico non viene mantenuto perché usava una classificazione ormai superata;
- i punti 5–8 sono stati riesaminati separatamente e le parti deboli vengono riscritte invece di adattare la nuova roadmap a vecchie API insicure;
- main resta invariato finché CI, multi-hotel, contratti RandAI, contratti RandApp/shared e browser/device gate non risultano verdi.

## CI e quality gates

La CI esegue:

1. dependency security audit;
2. Quality Matrix;
3. Critical Operational Gate;
4. Multi-hotel parity gate;
5. build;
6. bundle budget;
7. contratti RandAI;
8. contratti RandApp/shared;
9. Playwright Chromium/WebKit;
10. cross-platform browser gate;
11. device acceptance gate.

Le partizioni RandAI e RandApp/shared eseguono i file singolarmente e producono una lista diagnostica completa dei fallimenti. Questo migliora la diagnosi senza rendere il gate più permissivo: se un singolo contratto fallisce, la pipeline resta rossa.

## RandAI Control Center

Route protetta: `/randai`.

La console centralizza Overview, WhatsApp, Segnalazioni, Tecnici, Worker, Log, Manutenzioni, Conoscenze, Bozze/Approvazioni, Impianti, Scadenze, Regole, Anomalie, Costi/Osservabilità, Media/Drive e Sensori. L'accesso richiede membership attiva e permessi amministrativi; UI e console non sostituiscono RLS/RPC/Action Gateway.

Canali WhatsApp attualmente configurati:

- Hotel Giò: `+390759978247`;
- Chocohotel: `+390759970610`;
- Brigantino: nessun numero configurato.

Il flusso WhatsApp resta server-side, con validazione webhook, idempotenza, isolamento hotel e nessuna creazione di dettagli tecnici inventati.

## RandAI operativo successivo

La roadmap storica oltre il 16 comprende evaluation/benchmark, Multi-Agent, permission/autonomy, recovery/self-correction, software engineering agent, learning, skill/tool discovery, supervisor, proactive RandAI e Control Center. I moduli già presenti oltre il 16 restano disponibili, ma la numerazione 1–16 sopra è la base canonica da rendere interamente coerente prima di considerare concluso questo consolidamento.

I moduli operativi successivi già documentati includono anche Operational Context, Action Gateway, persistent supervisor/tasks, RandAI nelle Segnalazioni, Operational Learning e prioritization/dispatch. Reliability & Safety comprende scope guard, validation, safe write, RLS verification, audit/reversibility e offline/retry/concurrency.

## RandApp

Funzioni principali:

- Segnalazioni, foto, storico, priorità, presa in carico e completamento;
- Interventi, Planning Lavori e Planning Sale;
- Housekeeping e Rifornimenti interni;
- notifiche push/ntfy, meteo operativo, sensori e impianti;
- Magazzino autonomo collegato agli interventi tramite movimenti/ledger;
- offline/outbox IndexedDB, retry controllato, diagnostica e audit;
- shell responsive per iOS, Android e Windows.

Il pulsante `+` usa il router contestuale della shell: una singola azione viene aperta direttamente, più azioni aprono il launcher. I test devono verificare questo contratto attuale e non le vecchie implementazioni `allowedActions`/FAB monolitiche.

### Hotel Giò — camere

Regola operativa mantenuta:

- **Jazz:** numerazione a 4 cifre, per esempio `1101`, `1114`;
- **Wine:** numerazione a 3 cifre, per esempio `201`, `214`.

## Magazzino

Dominio autonomo ma collegato a RandApp. La fonte storica è il ledger dei movimenti; le giacenze sono saldi derivati/materializzati. Supporta catalogo, categorie/ubicazioni, QR/barcode, seriali, compatibilità, inventario fisico, trasferimenti e ricambi associati agli interventi. Un intervento non deve modificare silenziosamente la giacenza: il consumo deve produrre un movimento tracciato.

## Struttura repository

- `src/main.jsx` — entry;
- `src/randapp/` — shell/UI e domini RandApp;
- `src/randai/` — motori RandAI;
- `src/randai/maintenance/` — Knowledge + Procedure Assistant + Suggestions;
- `src/randai/runtime/` — planner/verifier/durable tasks/store/task control;
- `src/randai/memory/`, `context/`, `models/`, `gaps/` — Blocco 3;
- `src/randai/guidance/`, `projects/`, `observability/` — Blocco 4;
- `src/randai/control/` — Control Center;
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
- merge finale eseguito senza forzare main.
