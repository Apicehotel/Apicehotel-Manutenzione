# Spec — RandRadar architecture source

## Goal
Integrare `binhnguyennus/awesome-scalability` come fonte architetturale permanente senza introdurre codice o infrastruttura runtime.

## Requirements
- Classificazione umana: **FONTE**.
- Usage boundary: `REFERENCE_ONLY`.
- Nessuna dipendenza package/runtime.
- Pattern riusabili documentati in un unico playbook Rand.
- Nessun secondo owner per scheduler, auth, logging, cache, gateway o source of truth.
- Test anti-regressione e README aggiornato.
