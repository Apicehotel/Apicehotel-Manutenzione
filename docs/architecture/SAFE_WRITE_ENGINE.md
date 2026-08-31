# Safe Write Engine — Reliability Block 36

## Obiettivo

Il Blocco 36 rende esplicito il contratto di una scrittura operativa affidabile:

`preflight → idempotenza/precondizione → write atomica → read-back → verifica`

Un esito positivo del trasporto non è sufficiente. L'operazione è confermata solo quando lo stato persistito viene riletto e corrisponde all'intento richiesto.

## Decisioni KEEP / UPGRADE / REPLACE / ADD

| Componente | Decisione | Motivo |
| --- | --- | --- |
| Outbox IndexedDB `offline-store.js` | KEEP | Ha già coda, dedupe, retry controllato e cache per hotel. Il Blocco 39 la estenderà per concorrenza/offline senza crearne una seconda. |
| RPC atomiche Magazzino/Urgenti | KEEP | L'atomicità deve restare nel database quando una mutazione comprende più effetti. |
| Validation Layer Blocco 35 | KEEP | È il preflight comune; Safe Write lo orchestra senza duplicarne le regole. |
| Write client che considerano sufficiente la risposta della query | UPGRADE | Devono avere read-back e verifica quando sono critiche. |
| Creazione Planning Lavori parent + giorni in più statement client | REPLACE | Può lasciare stato parziale. Viene sostituita da una singola RPC PostgreSQL transazionale. |
| Idempotency key per create ripetibili | ADD | Impedisce duplicazioni in caso di doppio tap, retry esplicito o risposta persa. |
| Optimistic concurrency su righe Planning | ADD | `updated_at` è il version token esatto; update/delete usano compare-and-swap. |
| Temporal / nuovo workflow framework | NO ADD | Sarebbe duplicativo: RandAI ha già durable execution e RandApp dispone già di outbox/RPC. |
| Zod/XState | NO CHANGE | Il Blocco 36 non richiede nuovi runtime di schema o state machine. |

## Safe Write Engine

`src/reliability/safe-write-engine.js` è volutamente piccolo e dependency-free. Non è un workflow engine.

Proprietà:

- esegue il preflight prima di qualunque write;
- può riusare un risultato idempotente già esistente;
- esegue la write una sola volta: **nessun retry nascosto**;
- richiede un read-back indipendente;
- supporta aspettativa `present` per create/update e `absent` per delete;
- esegue un verificatore di dominio sul valore persistito;
- espone errori stabili `SAFE_WRITE_NOT_CONFIRMED`, `SAFE_WRITE_VERIFY_FAILED`, `SAFE_WRITE_CONFLICT`, `SAFE_WRITE_INVALID_CONTRACT`.

Il retry appartiene al chiamante o all'outbox solo quando l'operazione è dimostrabilmente idempotente.

## Planning Lavori

La precedente creazione eseguiva due write client separate: parent su `planning_lavori`, poi righe su `planning_lavori_giorni`. Un errore dopo il primo insert poteva lasciare un lavoro incompleto. Inoltre le righe giornaliere devono portare lo stesso `hotel_id` del parent per rispettare il perimetro RLS.

La migrazione `20260901003000_planning_work_safe_write.sql` introduce:

- `planning_lavori.mutation_id` con indice univoco parziale;
- `planning_lavori_giorni.updated_at` come version token;
- RPC `create_planning_work_safe(...)` in `SECURITY INVOKER`;
- normalizzazione/deduplicazione delle date nel database;
- parent e giorni nella stessa transazione PostgreSQL;
- `hotel_id` propagato dal server a ogni giorno;
- `created_by_user_id = auth.uid()` deciso dal server;
- reuse della stessa mutation id solo se il payload coincide;
- RLS del chiamante ancora autoritativa: la RPC non usa `SECURITY DEFINER`.

Dopo la RPC il client rilegge parent e giorni e verifica hotel, descrizione, mutation id, date e relazione parent/child.

### Update e delete Planning

Le righe caricate mantengono il valore testuale originale di `updated_at`; non viene convertito in millisecondi, per non perdere precisione PostgreSQL.

Update e delete filtrano per:

- `id`;
- `hotel_id`;
- `updated_at` quando disponibile.

Se il version token non coincide, la write non sovrascrive lo stato più recente e restituisce `SAFE_WRITE_CONFLICT`. Dopo update viene riletto lo stato; dopo delete viene verificata l'assenza.

## Confini intenzionali

- Il Safe Write Engine non sostituisce RLS, Action Gateway o Context & Scope Guard.
- Non trasforma Storage + Database in una transazione fittizia: i flussi con foto continuano a usare compensazione/cleanup quando necessario.
- Non migra in questo blocco tutte le outbox e tutti i moduli. Il Blocco 39 è il punto dedicato alla convergenza offline/concurrency globale.
- RandAI continua a non scrivere direttamente nel database.

## Benchmark esterno

Sono stati riutilizzati come pattern, non installati come dipendenze:

- semantica delle idempotency key in stile Stripe;
- principio Temporal secondo cui retry/durable activities devono produrre effetti idempotenti;
- atomicità e compare-and-swap PostgreSQL/PostgREST;
- Supabase RLS come autorità per il tenant/hotel.

L'architettura esistente è più adatta di un nuovo framework general-purpose perché evita un secondo orchestratore e mantiene il confine operativo nel database.

## Test e Definition of Done

`test/reliability-safe-write-engine.test.js` protegge ordine delle fasi, assenza di retry impliciti, idempotency hit, read-back obbligatorio, verifica, delete-by-absence e wiring Planning.

Il Blocco 36 è DONE solo quando codice, migrazione, test, questo documento e README sono allineati e i gate CI/multipiattaforma risultano verdi.
