# SPEC: 001-randcore-runtime-v2 — RandCore Runtime v2

## Status
DONE pending human merge

## Problem
L'ecosistema possiede già durable runtime, scheduler, health e recovery, ma manca un contratto operativo unico per eventi, job, worker heartbeat, retry osservabili e dead-letter. Creare sottosistemi paralleli produrrebbe duplicazione e drift.

## Outcome
RandCore diventa il coordinatore canonico di eventi e job, riusando `RandDurableRuntime` per i workflow durevoli e lasciando invariati gli owner esistenti di scheduler, autorizzazione, RLS, recovery e health.

## Requirements
- envelope eventi HOTEL/SYSTEM fail-closed;
- correlation/causation id;
- fan-out verso handler tramite `publish()`;
- lifecycle job esplicito;
- retry bounded e dead-letter;
- worker register/heartbeat/stale detection;
- snapshot operativo;
- start/resume integrati con `RandDurableRuntime`;
- store contract sostituibile con adapter persistente;
- nessuna nuova dipendenza runtime.

## Acceptance criteria
- test Group 3 coprono eventi, lifecycle, retry/dead-letter, worker stale e snapshot;
- contratti Group 3 preesistenti restano verdi;
- CI della PR è verde;
- README/documentazione descrivono ownership e failure model;
- nessun push/merge diretto su `main`.

## Security and hotel isolation
Gli eventi HOTEL richiedono `hotelId`; gli eventi SYSTEM non possono fingere uno scope hotel. RandCore Runtime non concede autorizzazioni: RLS/RPC/RandTool Gateway e `RandDurableRuntime` mantengono i propri boundary. Worker stale non possono acquisire nuovi job.
