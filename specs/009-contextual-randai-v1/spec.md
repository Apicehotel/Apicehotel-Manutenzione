# SPEC: 009-contextual-randai-v1 — RandAI contestuale nel Focus Mode

## Status
READY_FOR_HUMAN_REVIEW

## Problem
RandAI nel dettaglio appare ancora come una card separata e gli Interventi pubblicano contesto senza una presenza assistiva inline.

## Outcome
RandAI diventa una capacità contestuale discreta del dettaglio operativo, espandibile senza cambiare pagina.

## Requirements
- R1: presenza compatta quando chiusa.
- R2: espansione inline, nessuna navigazione fuori dal Focus Mode.
- R3: Segnalazioni riusano workspace e Gateway/HITL esistenti.
- R4: Interventi usano lo stesso guidance engine ma restano read-only.
- R5: nessun secondo context bus o backend.

## Acceptance criteria
- AC1: RandAISuggestion compare dopo la Timeline.
- AC2: il testo “Apri RandAI” non è più il CTA principale.
- AC3: Interventi mostrano OperationalRandAI inline.
- AC4: OperationalRandAI non importa action gateway.
- AC5: README e test aggiornati.

## Security and hotel isolation
Context envelope hotel-scoped esistente. Le mutazioni Segnalazione restano dietro Action Gateway/HITL; Interventi non ricevono nuove mutazioni.

## UX and devices
Riga compatta touch-friendly, body espandibile, nessun modal, layout mobile/desktop.

## Data and retention
Nessuna nuova persistenza.

## Observability and recovery
Errori guidance mostrati inline; nessuna modifica operativa avviene in caso di errore.

## Open questions
NONE
