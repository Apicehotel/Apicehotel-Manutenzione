# Spec — RandCore Capability Router

## Problema
Le integrazioni tecniche rischiano di legare direttamente i consumer ai provider (RandGateway, notifiche, AI/OCR futuri), aumentando accoppiamento e duplicazioni.

## Obiettivo
Introdurre un solo router canonico capability → provider, senza sostituire auth, RLS, HITL, audit, scheduler, database o RandGateway.

## Requisiti
- provider registrabili e rimovibili;
- selezione deterministica per priorità;
- preflight disponibilità;
- fail-closed senza provider;
- trace minima senza input operativi;
- health snapshot;
- fallback post-esecuzione disabilitato per default;
- nessun fallback delle mutazioni protette salvo errore esplicitamente retry-safe;
- primo adapter reale: operational.action → RandGateway.
