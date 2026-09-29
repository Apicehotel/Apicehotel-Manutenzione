# Plan

## Canonical owners
- Capability routing e provider registry: RandCore.
- Azioni condivise: `src/randai/actions/catalog.js`.
- Scritture operative e policy: RandGateway + Tool Gateway + RandSecure/HITL + RLS/RPC.
- Health: RandCore Health.

## Current state
Action Gateway chiamava direttamente `submitRandGatewayEnvelope()`. Le integrazioni future rischiavano selettori/provider logic sparsi.

## Proposed change
Aggiungere `RandCapabilityRouter`, provider contract e runtime canonico; registrare RandGateway per `operational.action`; far passare Action Gateway dal router senza cambiare envelope o autorità.

## RandRadar decision
`shy3130/tick-stock-panel`: **SOURCE / ADAPT**. Adottare il pattern capability routing; non importare stack finanziario, storage DuckDB/Parquet, frontend o runtime del progetto.

## Rollback
Rimuovere i tre moduli capability e ripristinare in Action Gateway la chiamata diretta a `submitRandGatewayEnvelope()`. Nessuna migrazione DB o dato persistente deve essere annullato.

## Tests and evidence
- `npm run test:capabilities`
- `npm run spec:validate`
- test globale repository via CI
- workflow Group 1–7 e CI principale
- verifica diff PR e mergeability

## Zombie check
Nessun owner esistente viene duplicato: il router orchestri i provider e RandGateway resta proprietario dell'ingresso governato. Nessun modulo viene eliminato perché non è stato identificato un duplicato sicuro da rimuovere.

## Sequenza
1. primitive router/provider;
2. adapter RandGateway;
3. integrazione Action Gateway;
4. export core;
5. test;
6. README/docs;
7. CI + revisione umana.
