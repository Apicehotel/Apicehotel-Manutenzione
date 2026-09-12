# SPEC: 005-randai-runtime-hitl-v1 — RandAI Runtime / HITL / Sandbox

## Status
IMPLEMENTING

## Problem
RandAI possiede già autonomy engine, agents/coordinator, Action Gateway, RandSecure e Durable Runtime, ma manca un contratto unico che trasformi rischio/tool permission in AUTO/PREVIEW/APPROVAL/BLOCK e un sandbox boundary esplicito.

## Outcome
Unificare l'esecuzione governata senza creare owner paralleli, mantenendo Action Gateway come unico approval/execution boundary per mutazioni protette.

## Requirements
- READ_ONLY automatico;
- LOW_RISK automatico con audit se mutante;
- MEDIUM_RISK preview/confirmation;
- HIGH_RISK, WRITE_PROTECTED e ADMIN richiedono approvazione umana;
- CRITICAL bloccato;
- nessun unrestricted host execution;
- stesso hotel e permessi esistenti restano autoritativi;
- nessun secondo orchestratore/approval store;
- zero nuova dipendenza runtime.

## Acceptance criteria
- Group 7 verde;
- Group 1-6 restano verdi;
- CI completa verde;
- README/architecture aggiornati;
- PR stacked e human review obbligatoria.

## Security and hotel isolation
Il Punto 6 non concede nuove autorizzazioni. Identità, hotel scope, Tool Gateway, RandSecure, RLS/RPC e Action Gateway restano autoritativi. Il runtime HITL può solo restringere l'esecuzione: preview, richiesta di approvazione o blocco. Gli adapter sandbox non possono abilitare unrestricted host execution; ogni tool mutante resta soggetto agli stessi controlli hotel-scoped e all'audit canonico.
