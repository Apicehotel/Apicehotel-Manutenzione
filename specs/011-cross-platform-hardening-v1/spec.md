# SPEC: 011-cross-platform-hardening-v1 — Viewport adattivo canonico

## Status
READY_FOR_HUMAN_REVIEW

## Problem
Shell, Focus Mode e full-screen usano contratti viewport equivalenti ma duplicati; VisualViewport non ripulisce tutti i token e non espone orientamento/larghezza.

## Outcome
Un solo contratto cross-platform governa viewport, tastiera, safe-area, rotazione e UI Grande senza fork iOS/Android.

## Requirements
- R1: Shell/Focus/full-screen consumano token viewport canonici.
- R2: VisualViewport alimenta altezza, larghezza, offset e stato tastiera.
- R3: keyboard detection evita falsi positivi da browser chrome.
- R4: resize/orientationchange funzionano anche senza VisualViewport.
- R5: teardown elimina stato transitorio.
- R6: UI Grande ingrandisce controlli Focus Mode.
- R7: phone/tablet/desktop restano un unico contratto adattivo.

## Acceptance criteria
- AC1: nessun override keyboard specifico nel Focus Mode.
- AC2: bridge testabile con portrait/keyboard/landscape.
- AC3: safe-area native/browser invariata.
- AC4: narrow phone + Grande impila Dock.
- AC5: README e test aggiornati.

## Security and hotel isolation
N/A; solo presentazione/viewport.

## UX and devices
iOS Safari/PWA, Android browser/native wrapper, tablet portrait/landscape, desktop Windows/macOS.

## Data and retention
N/A.

## Observability and recovery
Dataset keyboard/orientation ispezionabile; teardown fail-safe.

## Open questions
NONE
