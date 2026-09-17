# SPEC: release-readiness-v1 — Governed web and Android release readiness

## Status
IMPLEMENTED

## Problem
I browser/device gate esistono, ma il vecchio release gate era rimasto su una branch intermedia e Android non distingueva tra test PWA e pacchetto realmente firmato/provato.

## Outcome
Un solo release gate distingue target web e Android. Il web richiede evidenze automatiche/operative canoniche; Android aggiunge pacchetto firmato e prova su dispositivo reale.

## Scope
### In
- release gate puro e fail-closed;
- target web/android;
- riuso di Playwright/device acceptance esistenti;
- firma e device reale come evidenza Android.

### Out
- pubblicazione automatica su store;
- gestione di signing secret nel repository;
- secondo framework E2E o secondo packaging owner.

## Users and roles
- manutentore/reviewer tecnico: deve sapere se una build è realmente pronta;
- revisore umano: resta l'autorità finale di merge/release.

## Requirements
- R1: il gate web richiede quality, build, audit, E2E, device, rollback, separazione ambienti e review umana.
- R2: Android richiede anche signedPackage e realDevice.
- R3: nessun secret di signing viene salvato nel repository.
- R4: nessun tool esterno può bypassare il gate.

## Acceptance criteria
- AC1: evidenza web completa => READY.
- AC2: evidenza web completa senza firma/device reale => Android BLOCKED.
- AC3: Android completo => READY.
- AC4: target sconosciuto => fail-closed.

## Security and hotel isolation
Nessun accesso dati hotel aggiunto. Le chiavi firma restano esterne al repository e non entrano nel frontend.

## UX and devices
Riusa `test/device-acceptance.mjs` e `docs/DEVICE_ACCEPTANCE.md`; nessun nuovo runtime UI.

## Data and retention
N/A: nessun nuovo dato operativo persistente.

## Observability and recovery
Il comando stampa evidenze mancanti in JSON. Rollback: rimuovere i file release gate senza migrazioni dati.

## Open questions
- NONE
