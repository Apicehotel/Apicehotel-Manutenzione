# PLAN: 013-operational-chaos-hardening-v1

## Canonical owners
- operational-action-guard.js: single-flight/error boundary client.
- domain detail components: payload e success navigation.
- existing offline stack: queue/retry/conflict.
- existing device gates: viewport/offline/reconnect.

## Current state
Interventi attendono le mutazioni; Segnalazioni no. Task e Supply hanno lock locali con feedback incompleto.

## Proposed change
Unificare il comportamento con un guard condiviso e un test chaos esplicito in CI.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: primitives interne + Playwright già installato.
- Rationale: nessun chaos framework esterno è necessario; introdurlo ora aumenterebbe dipendenze e tempi CI senza coprire meglio questo failure mode.

## Architecture and boundaries
UI action -> Operational Action Guard -> existing domain mutation -> success navigation. Offline/idempotency/server authority restano invariati.

## Migration and rollout
Frontend only; nessuna migrazione DB.

## Rollback
Revert del commit Punto 8: ripristina guard locali/precedenti. Nessun dato o schema da ripristinare.

## Tests and evidence
- test/operational-chaos-gate.test.js
- test/device-acceptance.mjs
- test/point6-resilience.test.js
- CI + Ocean post-merge

## Zombie check
I lock locali duplicati di Task/Interventi vengono sostituiti dal guard condiviso; il README non deve più dichiarare viva /ui-v2-preview.
