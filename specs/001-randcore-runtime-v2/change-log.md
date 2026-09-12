# CHANGE LOG: 001-randcore-runtime-v2

## Changes

- 2026-09-12: la roadmap iniziale è stata corretta per evitare `RandQueue2`, `RandScheduler2` e `RandHealth2`; scelta la convergenza su owner esistenti.
- 2026-09-12: aggiunto RandCore Runtime v2 con event contract, fan-out, job state machine, retry/dead-letter, worker heartbeat/stale e snapshot.
- 2026-09-12: collegato il lifecycle job a `RandDurableRuntime` tramite start/resume senza modificare il durable engine esistente.
- 2026-09-12: aggiunti test Group 3 e documentazione architetturale.
- 2026-09-12: Group 3 CI reso valido per PR stacked; merge su `main` resta umano.
