# PLAN: 010-operational-detail-convergence-v1

## Canonical owners
- TaskResourceDetail.jsx: Avvisi/Promemoria.
- SupplyRequestDetail.jsx: Richieste.
- task-supply-timeline.js: timeline pure.
- Shell.jsx: Focus Mode.

## Current state
Task è correttamente hub; i dettagli reali sono nei child view. Supply gestisce item direttamente nella lista.

## Proposed change
Migrare le singole risorse, non gli hub.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: componenti canonici creati nei Punti 1–4.
- License: N/A.
- Rationale: nessuna dipendenza esterna migliora il contratto interno già stabile.

## Architecture and boundaries
List -> selected resource -> onDetailChange -> Shell Focus Mode -> canonical detail.

## Migration and rollout
Urgent, Reminder, Supply request. Planning escluso finché non esiste un item detail.

## Rollback
Ripristino azioni inline; nessuna migrazione DB.

## Tests and evidence
- test/operational-detail-convergence.test.js
- CI canonica
- Ocean post-merge

## Zombie check
Azioni primarie duplicate nelle liste e window.confirm reminder vengono rimossi. Form di creazione/modifica restano.
