# SPEC: 006-operational-detail-v1 — Focus operativo canonico

## Status
READY_FOR_HUMAN_REVIEW

## Problem
I dettagli operativi sono stati aperti con primitive e ownership differenti. Questo permette a lista, shell, bottom nav e FAB di convivere con un dettaglio e produce incoerenza visiva e sovrapposizioni.

## Outcome
Un solo proprietario canonico del dettaglio operativo. Quando una risorsa è aperta la Shell entra in Focus Mode e il dettaglio sostituisce, non ricopre, la lista.

## Scope
### In
- OperationalDetailPage condivisa.
- Focus Mode Shell.
- Migrazione Segnalazioni e Interventi.
- Contratto già esteso a task e supply.
- Safe-area, tastiera, landscape e desktop.
- Test e README.

### Out
- Timeline operativa.
- Dock con azioni contestuali oltre a Indietro.
- Ridisegno dei dati Supabase.
- Migrazione dei composer/filtri che non sono dettagli risorsa.

## Users and roles
- Tutti i ruoli autorizzati: dettaglio senza doppia navigazione e con ritorno stabile.

## Requirements
- R1: una sola superficie condivisa per i dettagli operativi.
- R2: nessun bottom nav/FAB/sidebar/header mentre il dettaglio è attivo.
- R3: il comando Indietro è persistente in basso.
- R4: la lista non resta renderizzata sotto il dettaglio.
- R5: il layout copre iOS, Android, landscape e desktop.

## Acceptance criteria
- AC1: Segnalazioni e Interventi usano OperationalDetailPage.
- AC2: Shell riceve lo stato del dettaglio e sospende il chrome concorrente.
- AC3: safe-area e visual viewport restano gestiti.
- AC4: i test di contratto passano.
- AC5: README documenta il nuovo owner.

## Security and hotel isolation
Nessuna modifica a query, RLS, RPC o hotel_id. Il cambio è esclusivamente presentation/navigation ownership.

## UX and devices
RandUI, safe-area adattive, 100dvh/100svh, visualViewport, landscape e desktop.

## Data and retention
N/A: nessuna modifica dati.

## Observability and recovery
I ViewErrorBoundary esistenti restano proprietari degli errori. Rollback = ripristino del rendering precedente dei due detail.

## Open questions
NONE
