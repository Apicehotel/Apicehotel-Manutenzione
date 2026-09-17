# SPEC: 002-rand-governance-v1 — RandRules / RandAudit / RandDoctor / RandSecure

## Status
READY_FOR_HUMAN_REVIEW

## Problem
RandCore Runtime v2 coordina eventi e job in modo durevole, ma manca ancora un livello canonico che trasformi eventi in intent governati, registri decisioni immutabili e produca diagnosi senza duplicare authorization, health, scheduler o Action Gateway esistenti.

## Outcome
Un solo pipeline di governance: `RandCore event → RandRules → action intent → RandSecure → RandAudit → RandCore/Action Gateway`. RandDoctor compone health/evidence esistenti e produce findings, senza diventare un secondo health system.

## Requirements
- regole dichiarative, deterministiche, versionate, senza eval/codice arbitrario;
- scope HOTEL/SYSTEM fail-closed e isolamento hotel;
- intent tipizzati che non eseguono azioni direttamente;
- security decision layer che può solo restringere e non sostituisce RLS/RPC/RandTool Gateway/Action Gateway;
- audit append-only persistente con redazione automatica dei campi sensibili;
- regole e audit persistenti su Supabase/Postgres, server-side service-role only;
- doctor che aggrega RandCore snapshot e health evidence esistenti;
- severità, codici e remediation intent espliciti;
- nessuna nuova dipendenza runtime.

## Acceptance criteria
- test Group 4 coprono rule matching, hotel isolation, security decisions, secret redaction, audit immutability e doctor findings;
- migration DB applica RLS, privilegi minimi e immutabilità audit;
- nessuna azione viene eseguita direttamente da RandRules/RandSecure/RandDoctor;
- README e architettura descrivono ownership e connessioni future;
- CI completa verde;
- branch dedicata + PR stacked, nessun merge/deploy automatico.

## Security and hotel isolation
RandSecure non concede permessi. Valida coerenza hotel, allowlist azioni, scope richiesti e livello rischio prima che un intent possa raggiungere i boundary esistenti. MEDIUM/HIGH richiedono approvazione; CRITICAL richiede anche scope `critical:execute`. UNKNOWN/invalid viene negato fail-closed.
