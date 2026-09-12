# CHANGE LOG: 001-randcore-runtime-v2

## Changes

- 2026-09-12: la roadmap iniziale è stata corretta per evitare `RandQueue2`, `RandScheduler2` e `RandHealth2`; scelta la convergenza su owner esistenti.
- 2026-09-12: aggiunto RandCore Runtime v2 con event contract, fan-out, job state machine, retry/dead-letter, worker heartbeat/stale e snapshot.
- 2026-09-12: collegato il lifecycle job a `RandDurableRuntime` tramite start/resume senza modificare il durable engine esistente.
- 2026-09-12: aggiunti test Group 3 e documentazione architetturale.
- 2026-09-12: Group 3 CI reso valido per PR stacked; merge su `main` resta umano.
- 2026-09-12: verificato che il repository non possedeva una queue/outbox Postgres canonica riutilizzabile; evitata quindi una falsa integrazione con owner inesistenti.
- 2026-09-12: aggiunto `SupabaseRandCoreStore` come adapter produttivo; `InMemoryRandCoreStore` resta test/reference only.
- 2026-09-12: aggiunte tabelle persistenti `randcore_events`, `randcore_jobs`, `randcore_workers`, `randcore_dead_letters` con RLS abilitata e accesso runtime server-side.
- 2026-09-12: aggiunte RPC service-role-only per claim atomica, rinnovo lease owner-bound e recovery concorrente con `FOR UPDATE SKIP LOCKED`.
- 2026-09-12: aggiunta recovery restart/redeploy; lease scaduto torna `RETRYING` oppure entra in dead-letter persistente/idempotente a tentativi esauriti.
- 2026-09-12: aggiunti test anti-regressione per lease, restart recovery, dead-letter idempotente e security contract delle migration.
- 2026-09-12: resi gli eventi persistenti immutabili: collisioni dello stesso `eventId` con contenuto differente vengono bloccate dall'adapter e le mutazioni vengono rifiutate anche dal trigger Postgres.
- 2026-09-12: eliminata la dipendenza dai grant impliciti Supabase: `anon/authenticated` sono revocati esplicitamente, `service_role` riceve solo i privilegi tabella necessari e la claim RPC rifiuta worker non registrati.
