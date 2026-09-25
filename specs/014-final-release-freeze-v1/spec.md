# SPEC: 014-final-release-freeze-v1 — Release readiness + freeze finale

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Il release checker esiste ma non è un gate CI esplicito; il freeze finale non ha ancora un artefatto governato che distingua web READY da target nativi non provati.

## Outcome
RandApp entra in LTS 1.0 solo dopo web release readiness, invarianti ambiente e governance verificati. I target nativi non provati restano esplicitamente BLOCKED/DEFERRED invece di ereditare il READY web.

## Requirements
- R1: Web Release Readiness gate nella CI canonica.
- R2: Final Freeze gate successivo al device gate.
- R3: Vercel Git auto-deploy resta disattivato.
- R4: Ocean resta preview e non produzione.
- R5: Android signed package + real device restano fail-closed.
- R6: freeze 12 mesi con soli bugfix/security/recovery/docs ordinari.
- R7: feature/architecture/schema/major deps richiedono eccezione umana + rollback + release gate.
- R8: artefatto freeze conservato 365 giorni.
- R9: nessun secondo release gate o rollback owner.

## Acceptance criteria
- AC1: `npm run release:check` deve risultare READY in CI.
- AC2: `npm run freeze:check` produce artefatto FROZEN.
- AC3: Android senza evidenza reale resta BLOCKED senza bloccare il freeze web.
- AC4: direct-main sempre vietato dalla freeze policy.
- AC5: README/documentazione descrivono stato corrente.
- AC6: runtime preview zombie non può rientrare.

## Security and hotel isolation
Nessun cambiamento a dati, RLS, auth o secret. Signing secret non entra nel repository.

## UX and devices
Riusa browser/device acceptance già verificati; nessuna nuova UI runtime.

## Data and retention
Solo artefatto CI di evidenza, retention 365 giorni.

## Observability and recovery
Freeze artifact espone web/android/distribution/invariants. Rollback resta `src/deployment-recovery.js` + Git/workflow governati.

## Open questions
NONE
