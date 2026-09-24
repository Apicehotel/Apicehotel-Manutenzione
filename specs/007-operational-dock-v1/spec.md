# SPEC: 007-operational-dock-v1 — Dock operativo contestuale

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Focus Mode ha un comando Indietro stabile ma le azioni primarie restano duplicate nel corpo e cambiano posizione tra domini.

## Outcome
Un footer operativo unico con Indietro + al massimo una azione primaria contestuale, autorizzata dal dominio.

## Scope
### In
- OperationalDock condiviso.
- Segnalazioni: azione primaria derivata da stato/permessi.
- Interventi: completamento nel Dock con gate ricambi/busy.
- Rimozione delle azioni primarie duplicate dal corpo.
- Mobile/desktop/safe-area.
- Test e README.

### Out
- Timeline del Punto 3.
- Secondary overflow menu.
- Task/Rifornimenti item detail, non ancora presenti come schede singole.

## Users and roles
- Operatori autorizzati: azione principale sempre nello stesso posto.
- Utenti read-only: solo Indietro.

## Requirements
- R1: Indietro sempre presente.
- R2: massimo una azione primaria.
- R3: il Dock non decide permessi o stato di dominio.
- R4: disabled/busy sono fail-safe.
- R5: nessuna duplicazione della primary action nel body.

## Acceptance criteria
- AC1: OperationalDock è condiviso.
- AC2: issue todo/waiting/tecnico mappano una primary action quando autorizzati.
- AC3: intervento non completabile con partsPending.
- AC4: item done/read-only mostrano solo Indietro.
- AC5: test e README aggiornati.

## Security and hotel isolation
Nessun cambio RLS/RPC. Le capability esistenti restano l’autorità UI; il backend resta authority finale.

## UX and devices
Dock safe-area aware, touch target grande, layout a due azioni su mobile e larghezza contenuta su desktop.

## Data and retention
N/A.

## Observability and recovery
Gli errori delle mutazioni restano nei flussi esistenti; busy impedisce doppio invio sull’intervento.

## Open questions
NONE
