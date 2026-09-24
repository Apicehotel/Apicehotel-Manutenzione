# PLAN: 009-contextual-randai-v1

## Canonical owners
- RandAISuggestion.jsx: workspace Segnalazioni.
- OperationalRandAI.jsx: presenza read-only Interventi.
- randai-data.js + context/envelope.js: motore/context esistenti.

## Current state
Segnalazioni hanno un workspace potente ma visivamente dominante; Interventi pubblicano context senza UI RandAI contestuale.

## Proposed change
Rendere il workspace Segnalazioni una presenza compatta e aggiungere un reader inline per Interventi.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: stack RandAI interno già più completo di una nuova dipendenza.
- License: N/A.
- Rationale: nessun repository esterno giustifica un secondo assistant runtime prima della consegna.

## Architecture and boundaries
Operational resource -> existing context envelope -> existing guidance engine -> inline presence.
Mutazioni Issue -> existing Action Gateway/HITL. Intervention -> read-only.

## Migration and rollout
Segnalazioni + Interventi ora; Task/Rifornimenti riuseranno la stessa presenza quando avranno item detail.

## Rollback
Rimuovere OperationalRandAI e ripristinare lo styling precedente; nessuna migrazione dati.

## Tests and evidence
- test/contextual-randai-focus.test.js
- CI canonica
- Ocean post-merge

## Zombie check
Il vecchio CTA “Apri RandAI” viene eliminato. Nessun modulo RandAI core è zombie.
