# SPEC: 003-randmind-v2 — Verified memory and temporal governance

## Status
IMPLEMENTING

## Problem
RandMind LIVE possiede già memoria governata, ma manca un bridge canonico da RandAudit verificato, una semantica temporale completa per supersession storica e un workflow esplicito per conflict resolution/retention senza automazioni distruttive.

## Outcome
RandMind resta l'unico owner della memoria e acquisisce verified audit ingestion, recall as-of, conflict resolution governata, retention planning non distruttivo e provenance end-to-end.

## Requirements
- nessun secondo memory store;
- solo outcome audit esplicitamente verificati diventano memoria VERIFIED;
- hotel isolation fail-closed;
- temporal recall current/historical distinto;
- conflict resolution autorizzata e atomica;
- retention legal-hold safe e mai autonoma;
- zero nuove dipendenze runtime.

## Acceptance criteria
- Group 5 verde;
- Group 4 governance resta verde;
- migration v2 preserva schema/store canonici;
- README/architecture aggiornati;
- CI completa verde;
- PR stacked e review umana obbligatoria.

## Security and hotel isolation
Audit HOTEL può creare solo memoria dello stesso hotel. Conflict resolution usa `can_manage_randai_hotel`; retention planner non esegue forget e l'RPC esistente conserva authorization e legal hold.
