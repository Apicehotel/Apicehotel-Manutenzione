# SPEC: 20260925-randcore-capability-router — RandCore Capability Router

## Status
IMPLEMENTED_ON_BRANCH

## Outcome
Un solo layer canonico separa capacità logiche e provider tecnici senza sostituire RandGateway, autorizzazione, RLS, HITL, audit, scheduler o database.

## Requirements
- provider registrabili e rimovibili;
- selezione deterministica per priorità;
- preflight disponibilità;
- fail-closed senza provider;
- trace minima senza input operativi;
- health snapshot;
- fallback post-esecuzione disabilitato per default;
- nessun fallback delle mutazioni protette salvo errore esplicitamente retry-safe;
- primo adapter reale: `operational.action → randgateway`.

## Acceptance criteria
- il provider con priorità migliore e disponibile viene selezionato;
- provider non disponibile al preflight non viene eseguito;
- assenza di provider produce `CAPABILITY_UNAVAILABLE`;
- una mutazione protetta non passa al provider successivo dopo un errore generico;
- fallback esplicito funziona solo su errore retry-safe;
- health snapshot non considera disponibile un provider disabilitato;
- Action Gateway continua a raggiungere RandGateway attraverso il router;
- test repository e CI devono restare verdi.

## Security and hotel isolation
Il router non concede permessi e non cambia hotel scope. `hotelId`, membership, RLS/RPC, RandSecure/HITL e RandGateway restano autorità esistenti. Le trace non contengono input/payload operativi. Nessuna chiave service-role o secret viene introdotta nel frontend.

## Problema
Le integrazioni tecniche rischiano di legare direttamente i consumer ai provider (RandGateway, notifiche, AI/OCR futuri), aumentando accoppiamento e duplicazioni.

## Obiettivo
Introdurre un solo router canonico capability → provider mantenendo invariati i boundary di sicurezza esistenti.
