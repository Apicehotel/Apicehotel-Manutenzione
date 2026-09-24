# SPEC: 012-runtime-zombie-cleanup-v1 — Pulizia legacy/zombie runtime

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Dopo la convergenza Focus Mode e l'hardening cross-platform restano owner UI transitori: una preview RandUI v2 isolata, un fix urgente separato e un blocco tablet duplicato nella foundation.

## Outcome
RandApp mantiene un solo owner runtime per Shell e geometria adattiva, senza cancellare storia o migrazioni utili.

## Requirements
- R1: rimuovere la route runtime /ui-v2-preview e il relativo prototipo isolato.
- R2: assorbire urgent-shell-layout-fix.css nell'owner adaptive-layout.css.
- R3: rimuovere la geometria 1024–1199 duplicata da foundation.css.
- R4: non eliminare migrazioni Supabase, documentazione storica o sheet di creazione ancora attivi.
- R5: aggiungere un gate anti-zombie.

## Acceptance criteria
- AC1: main.jsx non importa né instrada randui-v2.
- AC2: main.jsx non importa urgent-shell-layout-fix.css.
- AC3: adaptive-layout.css contiene il contratto urgente ancora necessario.
- AC4: foundation.css non possiede più la Shell tablet.
- AC5: test RandUI 96 segue il nuovo owner.
- AC6: README e test aggiornati.

## Security and hotel isolation
Nessuna authority, policy RLS o dato viene modificato.

## UX and devices
La pulizia conserva lo stesso comportamento phone/tablet/desktop già validato al Punto 6.

## Data and retention
Nessuna migrazione dati. Documentazione e migrazioni storiche vengono conservate.

## Observability and recovery
Il gate anti-zombie fallisce se route/import o secondo owner tornano nel runtime.

## Open questions
NONE
