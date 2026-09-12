# RandCore Runtime v2

RandCore Runtime v2 è il contratto operativo canonico per eventi, job, worker e workflow durevoli dell'ecosistema Rand. Non sostituisce `RandDurableRuntime`: lo orchestra e lo rende osservabile insieme agli altri lavori asincroni.

## Obiettivi

- un solo envelope evento per RandApp/RandAI/RandMind/RandRadar/RandChat e futuri moduli;
- coda/job state machine esplicita e fail-closed;
- retry bounded con dead-letter dopo esaurimento;
- worker registry con heartbeat e rilevazione `STALE`;
- snapshot operativo per RandCore Health/Dashboard;
- collegamento deterministico con `RandDurableRuntime` per start/resume;
- nessun secondo scheduler, authorization layer, audit system o database parallelo.

## Event contract

Ogni evento contiene `eventId`, `type`, `source`, `scope`, `hotelId`, `occurredAt`, `correlationId`, `causationId` e `payload`.

Gli eventi `HOTEL` richiedono `hotelId`. Gli eventi `SYSTEM` non possono portare `hotelId`: la distinzione è esplicita e fail-closed. `correlationId` permette di seguire una catena operativa; `causationId` collega l'evento che ha causato il successivo.

`publish()` effettua fan-out verso una o più route/handler creando job indipendenti ma correlati allo stesso evento.

## Job lifecycle

Stati canonici:

`QUEUED → RUNNING → SUCCEEDED`

Retry bounded:

`RUNNING → RETRYING → QUEUED/RUNNING`

Quando i tentativi retryable sono esauriti:

`RUNNING → DEAD_LETTER`

Un errore non retryable termina in `FAILED`. `CANCELLED` è terminale. Le transizioni non previste vengono rifiutate.

## Worker health

Ogni worker deve essere registrato e inviare heartbeat. Un worker oltre `workerStaleAfterMs` diventa `STALE` e non può acquisire nuovi job. RandCore non tratta mai `STALE` come `HEALTHY`.

## Durable runtime

`RandDurableRuntime` resta proprietario di idempotenza, checkpoint, resume, reauthorization e retry interni dei workflow lunghi. `RandCoreRuntime.startDurable()` associa il run al job; `resumeDurable()` mantiene sincronizzato lo stato del job con il risultato durevole.

## Storage

`InMemoryRandCoreStore` è l'implementazione di riferimento/test. Il runtime dipende da un contratto store verificato (`assertRandCoreStore`) per consentire un adapter persistente futuro senza cambiare la semantica del runtime. La source of truth produttiva resta Supabase/Postgres dove previsto dall'architettura Rand.

## Scheduler

Non viene introdotto un secondo scheduler. Gli scheduler/trigger già canonici producono eventi/job verso RandCore Runtime. In futuro RandRules potrà reagire agli eventi senza assumere ownership della coda o dell'esecuzione.

## Sicurezza e multi-hotel

Il runtime non concede permessi. Gli eventi HOTEL mantengono il contesto hotel; autorizzazione/RLS/RPC/RandTool Gateway restano autorità separate. I workflow durevoli continuano a rivalidare identità, hotel e scope tramite `RandDurableRuntime`.

## Failure model

- retry solo se esplicitamente retryable;
- tentativi limitati da `maxAttempts`;
- retry esauriti in dead-letter osservabile;
- worker stale bloccato prima del claim;
- transizioni illegali bloccate;
- store non conforme rifiutato in costruzione;
- niente auto-replay della dead-letter: il replay futuro dovrà essere un'azione governata/auditata.

## Test e gate

`npm run test:group3` include `test/randai-group3-randcore-runtime.test.js` oltre ai contratti Group 3 esistenti. Il workflow Group 3 viene eseguito su ogni pull request, incluse PR stacked, per impedire bypass del gate cambiando branch base.

## Connessioni future

- RandRules: consume eventi e produce azioni/job, senza diventare queue owner;
- RandAudit/Doctor/Secure: leggono snapshot e failure evidence;
- RandMind/RandResearch: usano correlation/causation per provenance operativa;
- RandMCP/Gateway/RandChat: inviano lavori attraverso lo stesso contratto;
- dashboard RandCore: visualizza queue, worker, retry e dead-letter dallo snapshot.

## Zombie check

Nessun modulo esistente è stato eliminato: `RandDurableRuntime`, recovery engine, scheduler e health restano proprietari delle rispettive capacità. Non è stato trovato un duplicato sicuro da rimuovere durante questo blocco; la scelta è stata convergere, non riscrivere.
