# PLAN: 014-final-release-freeze-v1

## Canonical owners
- src/release/release-readiness.js: readiness puro.
- scripts/release-evidence.mjs: raccolta evidenze repository.
- src/release/freeze-policy.js: policy freeze pura.
- scripts/check-final-freeze.mjs: attestation repository/CI.
- Rand Constitution: lifecycle e human review.

## Current state
Release readiness è implementato ma non promosso a gate CI esplicito; non esiste un freeze artifact finale.

## Proposed change
Riutilizzare il gate esistente, aggiungere attestation freeze e documentare la release LTS senza introdurre tool esterni.

## RandRadar decision
- Decision: KEEP/ADAPT.
- Existing CI/Playwright/Ocean/Vercel governance are sufficient.
- Nessuna dipendenza esterna aggiunta: un nuovo release framework duplicerebbe owner già maturi.

## Architecture and boundaries
quality/device gates -> web release readiness -> final freeze attestation -> human merge. Produzione resta human-only.

## Migration and rollout
Solo CI/governance/documentazione; nessuna migrazione DB.

## Rollback
Revert del commit finale. Il runtime applicativo e i dati non cambiano; nessun rollback DB richiesto.

## Tests and evidence
- test/final-freeze-v1.test.js
- test/release-readiness-v1.test.js
- CI build/device/release/freeze
- Ocean post-merge

## Zombie check
Rimosso il riferimento README residuo a randui-v2. Nessun secondo release gate, deploy owner o rollback system viene creato.
