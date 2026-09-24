# PLAN: 012-runtime-zombie-cleanup-v1

## Canonical owners
- src/randapp/adaptive-layout.css: Shell geometry, safe areas e breakpoints.
- src/randapp/randui/foundation.css: composizione foundation, non geometria Shell.
- src/main.jsx: sole route runtime supportate.

## Current state
Tre residui transitori sopravvivono al nuovo contratto: preview shell parallela, fix urgente separato, blocco tablet duplicato.

## Proposed change
Rimuovere gli owner duplicati e migrare l'unica regola ancora necessaria nel proprietario canonico.

## RandRadar decision
- Decision: REMOVE/KEEP
- Remove: runtime prototype randui-v2 e fix stylesheet transitorio.
- Keep: RandUI v2 operativo sotto src/randapp/randui/, documentazione storica e migrazioni.
- Rationale: meno codice runtime e meno possibilità di regressioni senza perdere evidenza.

## Architecture and boundaries
main.jsx -> canonical RandApp -> randui/foundation -> adaptive-layout. Nessuna seconda shell.

## Migration and rollout
Solo codice frontend; nessuna migrazione DB o dependency change.

## Rollback
Ripristinare i file/route rimossi e il blocco foundation dal commit del Punto 7. Nessun dato da ripristinare.

## Tests and evidence
- test/runtime-zombie-cleanup.test.js
- test/randai-block25-randui-93-97.test.js
- CI canonica + Ocean post-merge

## Zombie check
La task stessa definisce il nuovo gate che impedisce il ritorno dei tre owner rimossi.
