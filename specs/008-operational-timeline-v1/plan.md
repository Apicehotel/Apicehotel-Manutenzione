# PLAN: 008-operational-timeline-v1

## Canonical owners
- operational-timeline.js: derivazione eventi.
- OperationalTimeline.jsx: rendering.
- Issues.jsx / InterventionsView.jsx: azioni operative, non cronologia.

## Current state
Stato e storia sono distribuiti tra note e blocchi separati.

## Proposed change
Derivare una timeline read-only dai dati già caricati. Nessuna seconda source of truth.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: pattern timeline work-order già selezionato al Punto 1.
- License: N/A.
- Rationale: implementazione locale minima; nessuna dipendenza necessaria.

## Architecture and boundaries
Authorized resource -> pure timeline builder -> OperationalTimeline. Le mutazioni restano nei domain component e nell’Operational Dock.

## Migration and rollout
Segnalazioni + Interventi ora; estensione futura soltanto tramite nuovi builder sullo stesso componente.

## Rollback
Rimuovere il rendering timeline e ripristinare le card storiche; nessuna migrazione DB.

## Tests and evidence
- test/operational-timeline.test.js
- CI canonica
- Ocean visual gate post-merge

## Zombie check
Le card storiche duplicate di completamento/assegnazione vengono rimosse; i controlli operativi restano.
