# SPEC: 008-operational-timeline-v1 — Timeline operativa evidence-first

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Il dettaglio Focus Mode è coerente nella navigazione ma la storia del lavoro resta dispersa tra card, note e stati.

## Outcome
Una timeline condivisa racconta il percorso operativo usando solo evidenze già persistite, senza timestamp inventati.

## Requirements
- R1: nessun timestamp sintetico.
- R2: eventi privi di timestamp restano visibili ma senza orario.
- R3: completamento e foto non devono essere duplicati fuori timeline.
- R4: ricambi intervento usano i timestamp reali del ledger.
- R5: builder separati dalla presentazione.

## Acceptance criteria
- AC1: Segnalazioni e Interventi usano OperationalTimeline.
- AC2: issue technicianRequestedAt viene letto dal campo persistito.
- AC3: requested/reserved/consumed/released dei ricambi producono eventi reali.
- AC4: stato corrente è riconoscibile.
- AC5: test e README aggiornati.

## Security and hotel isolation
Nessuna nuova query e nessun cambio di authority. La timeline riceve soltanto dati già autorizzati dal dettaglio hotel-scoped.

## UX and devices
Colonna singola mobile, contenuto limitato dalla superficie operativa su desktop, foto lazy-loaded.

## Data and retention
Nessuna nuova persistenza. Viene esposto nel mapper un timestamp già presente nel record segnalazione.

## Observability and recovery
Builder deterministici e testabili; rollback senza migrazioni.

## Open questions
NONE
