# Offline, Retry & Concurrency Hardening — Reliability Block 39

## Obiettivo

Il Blocco 39 rende la coda offline prevedibile anche con più tab/PWA, riconnessioni, retry e modifiche concorrenti da più dispositivi.

Catena di riferimento:

`azione → operationId stabile → outbox locale atomica → lease cross-tab → replay → CAS server → verifica/conflitto → complete oppure failure queue`

## Decisioni

### KEEP

- Dexie/IndexedDB e `src/offline-store.js`;
- compattazione create/update/delete già presente;
- idempotenza create Segnalazioni tramite `mutation_id`;
- conflict UX/failure queue già presente;
- Safe Write e audit dei Blocchi 36/38.

Non viene introdotto Temporal, Dexie Cloud o un nuovo sync framework. Il problema reale è nell'orchestrazione dell'outbox locale e nella concorrenza del record, non nella mancanza di un workflow engine.

### UPGRADE — identità operativa persistente

Ogni mutazione accodata riceve un `operationId` nello spazio `RND-OP-*` e lo conserva attraverso retry e failure/retry manuale. L'ID locale Dexie `++id` resta solo un ordinamento locale, non l'identità semantica dell'operazione.

La create Segnalazioni continua a usare `clientMutationId` per l'idempotenza server. Per delete Segnalazioni lo stesso `operationId` viene passato alla RPC di soft-delete e quindi entra nell'audit del Blocco 38.

### UPGRADE — lease cross-tab

Il vecchio booleano `draining` proteggeva solo la singola istanza JavaScript. Il Blocco 39 aggiunge un lease persistito per riga outbox:

- `leaseOwner` identifica l'istanza;
- `leaseUntil` rende il lease recuperabile dopo crash/chiusura;
- il claim avviene in una transazione IndexedDB;
- un'altra tab/PWA non può replayare la stessa riga finché il lease è valido;
- dopo successo la riga sparisce; dopo retry/failure il lease viene rilasciato.

Il lease è deliberatamente locale: non sostituisce l'idempotenza server e non pretende exactly-once delivery.

### UPGRADE — transazioni Dexie

Le modifiche che devono restare coerenti vengono raggruppate:

- enqueue + cache;
- create replay completata + id-map + cache + rimozione outbox;
- outbox → failures;
- failures → outbox su retry manuale;
- discard failure + cleanup blob.

Le chiamate di rete restano fuori dalle transazioni IndexedDB.

### UPGRADE — retry con jitter

Il backoff esistente viene mantenuto nei suoi gradini, aggiungendo jitter ±20% per ridurre replay simultanei dopo il ritorno della rete. Non viene introdotto un limite globale di tentativi: retry budget, circuit breaker e kill switch appartengono al Blocco 47.

### UPGRADE — optimistic concurrency reale

Le Segnalazioni conservano due rappresentazioni di `updated_at`:

- `updatedAt` numerico per UI/compatibilità;
- `updatedAtToken` con il timestamp PostgreSQL esatto per compare-and-swap.

Gli update offline replayati usano `id + hotel_id + updated_at` nella stessa UPDATE. Se il token non corrisponde, la write non avviene e l'operazione viene classificata come `OFFLINE_CONFLICT`.

Le delete usano `soft_delete_issue_cas(...)`: la funzione blocca la riga `FOR UPDATE`, verifica permesso/ownership e confronta `updated_at` nello stesso lock prima di applicare il soft-delete. Questo elimina la finestra TOCTOU del vecchio `SELECT → DELETE`.

## Benchmark

### Dexie

Le best practice Dexie raccomandano transazioni per sequenze locali che devono essere atomiche e sconsigliano chiamate async esterne durante la transaction. Il Blocco 39 segue questo modello: rete fuori, mutazioni IndexedDB correlate dentro una singola transaction.

### Supabase/PostgREST

Supabase supporta filtri concatenati su UPDATE/DELETE e ritorno della riga con `.select()`. Il CAS usa quindi il token `updated_at` direttamente nel filtro server-side invece di affidarsi a un confronto precedente nel browser.

### Workflow engine esterno

Temporal/LangGraph restano **NO ADD** per l'outbox RandApp: il Durable Runner RandAI già copre i task persistenti e un secondo runtime aumenterebbe complessità senza risolvere meglio la coda IndexedDB del client.

## Garanzie ottenute

1. una mutazione offline ha identità stabile attraverso i retry;
2. più istanze locali non replayano contemporaneamente la stessa riga entro il lease;
3. cache/outbox/id-map/failure non restano a metà nelle sequenze critiche locali;
4. i retry non partono tutti allo stesso millisecondo dopo una riconnessione;
5. update/delete Segnalazioni non sovrascrivono silenziosamente una versione più nuova quando è disponibile il token esatto;
6. delete e audit condividono lo stesso `operationId`;
7. un conflitto permanente entra nella failure queue invece di essere ritentato all'infinito come errore di rete.

## Limiti intenzionali

- non viene promesso exactly-once su rete distribuita;
- il lease locale non è un lock database;
- i vecchi record cache senza `updatedAtToken` usano temporaneamente il fallback legacy finché non vengono ricaricati dal server;
- i retry budget globali appartengono al Blocco 47;
- la matrice avversariale completa appartiene al Blocco 49.

## Definition of Done

- Dexie schema v4 con operation identity + lease;
- transazioni atomiche nei passaggi locali critici;
- backoff jittered;
- CAS update Segnalazioni;
- CAS soft-delete server-side;
- operationId propagato alla delete auditata;
- test unitari/strutturali verdi;
- migrazione provata e applicata allo schema reale;
- CI completa + browser/device gate verdi;
- README allineato.
