# PLAN: 011-cross-platform-hardening-v1

## Canonical owners
- adaptive-layout.css: viewport tokens + breakpoints + Large UI.
- system-insets.js: browser/native viewport bridge.
- operational-detail.css / ui-coherence.css: consumers only.

## Current state
Più superfici ripetono 100dvh/100svh e keyboard override.

## Proposed change
Centralizzare geometria viewport in token CSS alimentati dal bridge.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: native CSS VisualViewport/safe-area contract.
- License: N/A.
- Rationale: aggiungere Ionic/Capacitor soltanto per geometry aumenterebbe il rischio; il wrapper futuro è già supportato dal native inset bridge.

## Architecture and boundaries
Browser/native signals -> system-insets -> CSS tokens -> all surfaces.

## Migration and rollout
Nessuna migrazione dati. Un commit reversibile.

## Rollback
Revert del commit del Punto 6: ripristina i valori viewport diretti e il bridge precedente. Nessuna migrazione dati, schema o cache da annullare.

## Tests and evidence
- test/cross-platform-focus-hardening.test.js
- CI canonica
- Ocean visual gate post-merge

## Zombie check
Gli override keyboard duplicati in operational-detail/ui-coherence diventano zombie e vengono rimossi.
