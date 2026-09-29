# SPEC: 002-randradar-architecture-source — RandRadar architecture source

## Status

READY_FOR_REVIEW

## Problem

RandRadar distingue già tra candidate da adottare e fonti di scouting, ma non aveva ancora una fonte architetturale curata formalmente collegata a un playbook Rand. Senza questo boundary una reading list esterna potrebbe essere interpretata in futuro come dipendenza o come invito a copiare architetture hyperscale non proporzionate al contesto Rand.

## Outcome

`binhnguyennus/awesome-scalability` entra nel catalogo RandRadar come **FONTE / REFERENCE_ONLY**. I pattern riusabili vengono sintetizzati in un unico Rand Architecture Playbook e restano separati dal runtime applicativo.

## Requirements

- Classificazione umana: **FONTE**.
- Usage boundary: `REFERENCE_ONLY`.
- Nessuna dipendenza npm o runtime.
- Nessun nuovo servizio, scheduler, auth plane, logger, gateway, cache owner o source of truth.
- Pattern di reliability/scalability documentati in un solo playbook canonico.
- README, policy e skill RandRadar coerenti.
- Regression test che impedisca auto-adozione e dipendenza runtime accidentale.

## Acceptance criteria

- Il catalogo contiene `awesome-scalability` con `usageMode=REFERENCE_ONLY`.
- Il report interno resta `WATCH` e `assertSafeAdoption()` restituisce false.
- `package.json` non contiene dipendenze relative ad Awesome Scalability.
- `docs/architecture/RAND_ARCHITECTURE_PLAYBOOK_V1.md` esiste e include timeout/retry, idempotenza/dead-letter, rate limiting, cache/stale state, observability, graceful degradation e anti-overengineering.
- `npm run spec:validate` passa.
- La PR resta soggetta a CI e revisione umana prima del merge.

## Security and hotel isolation

Nessuna modifica a RLS/RPC, autenticazione, membership, `hotel_id`, secret, token o dati operativi. La fonte non riceve accesso runtime, non esegue codice e non può aggirare RandGateway, RandSecure/HITL, Action Gateway o RandAudit.
