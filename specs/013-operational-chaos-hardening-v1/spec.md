# SPEC: 013-operational-chaos-hardening-v1 — E2E/chaos operativo

## Status
READY_FOR_HUMAN_REVIEW

## Problem
I browser/device gate coprono viewport, offline e login, ma le nuove mutazioni Focus Mode non hanno un single-flight/error contract condiviso. Alcune Segnalazioni chiudono il dettaglio prima di sapere se la mutazione è riuscita.

## Outcome
Tutte le mutazioni principali di Segnalazioni, Interventi, Task e Rifornimenti sono fail-safe: una sola azione alla volta, close solo dopo successo, errore inline e retry possibile.

## Requirements
- R1: gate single-flight condiviso.
- R2: doppio invio non esegue una seconda mutazione.
- R3: failure rilascia il lock.
- R4: detail resta aperto su failure.
- R5: error feedback visibile inline.
- R6: chaos gate nominato in CI prima dei browser E2E.
- R7: riusare offline/reconnect/device coverage esistente, senza duplicarla.

## Acceptance criteria
- AC1: quattro domini importano useOperationalActionGuard.
- AC2: Issue non chiude immediatamente dopo onUpdate.
- AC3: Intervention/Task chiudono solo onSuccess.
- AC4: Supply serializza risoluzioni concorrenti.
- AC5: parent Reminder/Supply propagano le failure.
- AC6: test pure gate coprono concurrent/failure/retry/no-action.
- AC7: README e test aggiornati.

## Security and hotel isolation
Nessuna authority o RLS cambia. Il guard impedisce duplicazioni client-side ma non sostituisce idempotenza/server policy.

## UX and devices
Errore inline dentro Focus Mode; Dock busy/disabled; stesso comportamento phone/tablet/desktop.

## Data and retention
Nessuna nuova persistenza.

## Observability and recovery
Il gate restituisce reason BUSY/NO_ACTION, mantiene l'errore originale e sblocca sempre in finally.

## Open questions
NONE
