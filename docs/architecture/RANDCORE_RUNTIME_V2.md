# RandCore Runtime v2

RandCore Runtime v2 è il contratto operativo canonico per eventi, job, worker e workflow durevoli dell'ecosistema Rand. Non sostituisce `RandDurableRuntime`: lo orchestra e lo rende osservabile insieme agli altri lavori asincroni.

## Obiettivi

- un solo envelope evento per RandApp/RandAI/RandMind/RandRadar/RandChat e futuri moduli;
- coda/job state machine esplicita e fail-closed;
- retry bounded con dead-letter dopo esaurimento;
- worker registry con heartbeat e rilevazione `STALE`;
- claim atomica e lease rinnovabile per impedire doppia esecuzione;
- recovery deterministico dopo crash/redeploy;
- source of truth produttiva persistente su Supabase/Postgres;
- snapshot operativo per RandCore Health/Dashboard;
- collegamento deterministico con `RandDurableRuntime` per start/resume;
- nessun secondo scheduler, authorization layer, audit system o database parallelo.

## Event contract

Ogni evento contiene `eventId`, `type`, `source`, `scope`, `hotelId`, `occurredAt`, `correlationId`, `causationId` e `payload`.

Gli eventi `HOTEL` richiedono `hotelId`. Gli eventi `SYSTEM` non possono portare `hotelId`: la distinzione è esplicita e fail-closed. `correlationId` permette di seguire una catena operativa; `causationId` collega l'evento che ha causato il successivo.

`publish()` persiste prima l'evento e poi effettua fan-out verso una o più route/handler creando job indipendenti ma correlati allo stesso evento.

## Job lifecycle

Stati canonici:

`QUEUED → RUNNING → SUCCEEDED`

Retry bounded:

`RUNNING → RETRYING → QUEUED/RUNNING`

Quando i tentativi retryable sono esauriti:

`RUNNING → DEAD_LETTER`

Un errore non retryable termina in `FAILED`. `CANCELLED` è terminale. Le transizioni non previste vengono rifiutate.

## Claim, lease e recovery

La produzione usa `randcore_claim_job()` per acquisire un job in modo atomico. La claim incrementa `attempt`, assegna `worker_id` e imposta `lease_expires_at`. Un worker può rinnovare il lease soltanto sul proprio job `RUNNING` tramite `randcore_renew_job_lease()` e soltanto prima della scadenza.

`randcore_recover_expired_jobs()` usa `FOR UPDATE SKIP LOCKED` per recuperare in sicurezza i lavori abbandonati dopo crash/redeploy:

- se restano tentativi: `RUNNING → RETRYING`, worker/lease vengono liberati e `errorCode=LEASE_EXPIRED`;
- se i tentativi sono esauriti: `RUNNING → DEAD_LETTER` e la dead-letter viene inserita nella stessa transazione;
- la chiave unica `(job_id, reason)` rende la dead-letter idempotente.

Questo impedisce sia il job perso dopo un restart sia il doppio claim concorrente.

## Worker health

Ogni worker deve essere registrato e inviare heartbeat. Un worker oltre `workerStaleAfterMs` diventa `STALE` e non può acquisire nuovi job. RandCore non tratta mai `STALE` come `HEALTHY`.

Heartbeat del worker e lease del job sono segnali diversi: heartbeat dice che il worker è vivo; il lease dice che possiede ancora quello specifico job.

## Durable runtime

`RandDurableRuntime` resta proprietario di idempotenza, checkpoint, resume, reauthorization e retry interni dei workflow lunghi. `RandCoreRuntime.startDurable()` associa il run al job; `resumeDurable()` mantiene sincronizzato lo stato del job con il risultato durevole. Prima di riprendere un job ancora posseduto, il lease può essere rinnovato; un job recuperato in `RETRYING` può essere reclamato dal worker autorizzato e poi ripreso.

## Storage canonico

Produzione:

`SupabaseRandCoreStore → Supabase/Postgres`

Tabelle:

- `randcore_events` — eventi immutabili/logici e correlazione;
- `randcore_jobs` — stato, tentativi, owner, lease, output e durable run;
- `randcore_workers` — registry e heartbeat;
- `randcore_dead_letters` — fallimenti terminali retryable.

Migration: `supabase/migrations/20260912113000_randcore_runtime_v2_persistence.sql`.

`InMemoryRandCoreStore` resta soltanto implementazione deterministica di riferimento/test. Entrambi implementano lo stesso store contract verificato da `assertRandCoreStore`; il runtime non cambia semantica quando passa dalla memoria a Postgres.

## Sicurezza database

Le quattro tabelle hanno RLS abilitata e non espongono policy di lettura/scrittura ai client. Le RPC di claim, rinnovo lease e recovery revocano esplicitamente `PUBLIC`, `anon` e `authenticated` e concedono `EXECUTE` soltanto a `service_role`.

Di conseguenza `SupabaseRandCoreStore` deve essere istanziato esclusivamente server-side con un client Supabase privilegiato; `service_role` non deve mai raggiungere browser, PWA o modello AI.

## Scheduler

Non viene introdotto un secondo scheduler. Gli scheduler/trigger già canonici producono eventi/job verso RandCore Runtime. In futuro RandRules potrà reagire agli eventi senza assumere ownership della coda o dell'esecuzione.

## Sicurezza e multi-hotel

Il runtime non concede permessi. Gli eventi HOTEL mantengono il contesto hotel; autorizzazione/RLS/RPC/RandTool Gateway restano autorità separate. I workflow durevoli continuano a rivalidare identità, hotel e scope tramite `RandDurableRuntime`.

## Failure model

- retry solo se esplicitamente retryable;
- tentativi limitati da `maxAttempts`;
- retry esauriti in dead-letter osservabile;
- claim atomica con lease finito;
- rinnovo lease owner-bound;
- recovery dei lease scaduti dopo restart/deploy;
- worker stale bloccato prima del claim;
- transizioni illegali bloccate;
- store non conforme rifiutato in costruzione;
- niente auto-replay della dead-letter: il replay futuro dovrà essere un'azione governata/auditata.

## Test e gate

`npm run test:group3` include `test/randai-group3-randcore-runtime.test.js` oltre ai contratti Group 3 esistenti. I test coprono envelope, fan-out, state machine, retry/dead-letter, heartbeat, lease renewal, ownership, recovery dopo sostituzione dell'istanza runtime, idempotenza della dead-letter, integrazione Durable Runtime e contratto/security della migration Supabase.

Il workflow Group 3 viene eseguito su ogni pull request, incluse PR stacked, per impedire bypass del gate cambiando branch base.

## Connessioni future

- RandRules: consume eventi e produce azioni/job, senza diventare queue owner;
- RandAudit/Doctor/Secure: leggono snapshot e failure evidence;
- RandMind/RandResearch: usano correlation/causation per provenance operativa;
- RandMCP/Gateway/RandChat: inviano lavori attraverso lo stesso contratto;
- dashboard RandCore: visualizza queue, worker, retry e dead-letter dallo snapshot.

Queste connessioni sono predisposte ma non implementate in questo blocco: Punto 2 chiude il runtime, non apre in anticipo i blocchi successivi.

## Zombie check

Nessun modulo esistente è stato eliminato: `RandDurableRuntime`, recovery engine, scheduler e health restano proprietari delle rispettive capacità. Non è stato trovato un duplicato sicuro da rimuovere durante questo blocco; la scelta è stata convergere, non riscrivere.
