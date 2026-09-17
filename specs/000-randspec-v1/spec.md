# SPEC: 000-randspec-v1 — RandSpec governance

## Status
READY_FOR_HUMAN_MERGE

## Problem
RandFlow governa già implementazione, test, security e review, ma intent, acceptance criteria, task e cambi requisiti non hanno ancora un formato persistente unico e validabile.

## Outcome
Ogni nuovo lavoro sostanziale può essere descritto e verificato con SPEC/PLAN/TASKS/CHANGE senza introdurre un secondo lifecycle o una nuova autorità.

## Scope
### In
- Constitution Rand versionata.
- Template RandSpec.
- Validazione fail-closed.
- Contratto test e gate CI.
- PR checklist e documentazione.

### Out
- Installazione runtime di Spec Kit.
- Riscrittura delle feature esistenti.
- Modifiche a RLS, dati operativi o UI applicativa.

## Users and roles
- Maintainer umano: approva specifiche e merge.
- Agente: propone/implementa solo su branch e dentro i boundary.

## Requirements
- R1: RandSpec deve estendere RandFlow senza duplicarlo.
- R2: una spec reale deve avere quattro artefatti obbligatori.
- R3: la CI deve validare RandSpec.
- R4: i cambi requisiti devono essere registrabili.
- R5: la review umana resta obbligatoria.

## Acceptance criteria
- AC1: `npm run spec:validate` fallisce su artefatti/heading/stati task invalidi.
- AC2: `npm run test:randspec` protegge Constitution, template e CI.
- AC3: il README/documentazione collega RandSpec a RandFlow/RandRadar/RandCore.
- AC4: nessuna nuova dipendenza runtime.

## Security and hotel isolation
Nessun cambio runtime o dati hotel. Constitution mantiene RLS/RPC e freeze agenti come boundary superiori.

## UX and devices
N/A: governance di sviluppo, nessun cambio UI.

## Data and retention
N/A: soli file versionati Git.

## Observability and recovery
La CI produce il risultato del validatore; rollback = revert della PR.

## Open questions
- NONE
