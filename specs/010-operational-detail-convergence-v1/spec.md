# SPEC: 010-operational-detail-convergence-v1 — Convergenza Task e Rifornimenti

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Focus Mode copre Segnalazioni/Interventi ma Avvisi, Promemoria e Rifornimenti hanno ancora azioni e dettagli inline diversi.

## Outcome
Le singole risorse Task e Supply usano lo stesso dettaglio canonico senza trasformare hub e viste aggregate in falsi dettagli.

## Requirements
- R1: Avvisi e Promemoria usano kind task.
- R2: Richieste rifornimenti usano kind supply.
- R3: Task resta hub Avvisi+Promemoria.
- R4: Planning resta aggregato finché non apre una singola risorsa.
- R5: azioni primarie lista duplicate vengono rimosse.
- R6: timeline evidence-first usa solo timestamp persistiti.

## Acceptance criteria
- AC1: Shell riceve detail state da Urgent/Reminders/Supplies.
- AC2: Avviso usa Dock per presa in carico/completamento.
- AC3: Promemoria usa Dock per pausa/riattivazione.
- AC4: Supply conserva azioni per-item nel dettaglio e non inventa batch action.
- AC5: nessun window.confirm nel flusso Promemoria.
- AC6: README e test aggiornati.

## Security and hotel isolation
Nessuna nuova query o authority. Permessi esistenti decidono le azioni; supply resta hotel-scoped.

## UX and devices
Riusa Focus Mode/Dock/Timeline cross-device già governati.

## Data and retention
Nessuna nuova persistenza.

## Observability and recovery
Mutazioni esistenti; errori restano nei rispettivi owner.

## Open questions
NONE
