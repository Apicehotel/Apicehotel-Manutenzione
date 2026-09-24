# PLAN: 007-operational-dock-v1

## Canonical owners
- OperationalDetailPage.jsx: struttura Dock.
- Issues.jsx / InterventionsView.jsx: scelta dell’azione.
- operational-detail.css: layout cross-device.

## Current state
Il footer contiene solo Indietro; i CTA principali sono sparsi nel contenuto.

## Proposed change
Aggiungere OperationalDock e passare un oggetto primaryAction dal dominio. Nessuna registry parallela: l’azione usa direttamente le callback esistenti.

## RandRadar decision
- Decision: KEEP/ADAPT
- Candidate/source: pattern command bar già coerente con i riferimenti work-order analizzati al Punto 1.
- License: N/A.
- Rationale: nessun pacchetto esterno migliora il rapporto rischio/beneficio prima della consegna.

## Architecture and boundaries
Domain state/permission -> primaryAction -> OperationalDetailPage -> OperationalDock.
Il Dock non importa funzioni dati né policy.

## Migration and rollout
Segnalazioni e Interventi ora; Task/Rifornimenti riuseranno il contratto quando avranno item detail.

## Rollback
Ripristinare footer solo-Indietro e CTA nel body; nessuna migrazione dati.

## Tests and evidence
- test/operational-dock.test.js
- CI canonica
- Ocean post-merge

## Zombie check
Le CTA primarie duplicate nel body di IssueDetail/PlannedDetail diventano zombie e vengono rimosse. Le azioni secondarie/form restano necessarie.
