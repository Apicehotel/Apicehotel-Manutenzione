# PLAN: 001-randcore-runtime-v2

## Canonical owners
RandCore Runtime possiede event envelope, job lifecycle, worker registry/heartbeat e dead-letter coordination. `RandDurableRuntime` resta proprietario dei workflow riprendibili; scheduler, RLS/RPC, recovery e health esistenti non vengono duplicati.

## Current state
Retry e durable execution esistono, ma non sono collegati a un contratto comune di evento/job/worker. La roadmap teorica rischiava di introdurre Queue/Scheduler/Health paralleli.

## Proposed change
Aggiungere `src/randai/core/randcore-runtime.js`, test Group 3, documentazione e CI stacked-PR safe. Implementare fan-out evento, state machine, bounded retry/dead-letter, heartbeat/stale, snapshot e adapter seam per storage persistente.

## RandRadar decision
ADAPT dai pattern già studiati in DeskcommCRM/Sonarr; non installare code o event bus esterni. Il core richiesto è piccolo, deterministico e già compatibile con lo stack. Nuove dipendenze aumenterebbero superficie operativa senza beneficio sufficiente.

## Rollback
Rimuovere il nuovo modulo/test/spec/documento e ripristinare il workflow Group 3 precedente. `RandDurableRuntime` non viene modificato, quindi il rollback non altera i workflow durevoli esistenti.

## Tests and evidence
`npm run test:group3`, RandSpec validator e CI completa della PR. Evidenze finali: workflow verdi e diff limitato al Punto 2.

## Zombie check
Nessuna eliminazione: i componenti esistenti hanno ownership distinta o sono ancora referenziati. Non creare secondi scheduler/health/recovery runtime.
