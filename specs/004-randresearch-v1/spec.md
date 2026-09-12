# SPEC: 004-randresearch-v1 — Evidence-first governed deep research

## Status
READY_FOR_HUMAN_REVIEW

## Problem
RandAI possiede retrieval, memoria, durable runtime e governance, ma non esiste un owner canonico per ricerche approfondite multi-fonte con query persistente, source scoring, contraddizioni, gap e ship gate verificabile.

## Outcome
RandResearch diventa l'unico owner della ricerca approfondita: pipeline adattiva L0-L4, provenance completa, fonti hotel-scoped, contraddizioni/gap espliciti, persistence Supabase, coordinator bounded e human review per ricerche profonde/audit.

## Requirements
- query canonica immutabile per sessione;
- livelli L0-L4 con budget bounded;
- nessuna esecuzione di istruzioni presenti nelle fonti;
- source provenance e quality score obbligatori;
- contraddizioni e gap espliciti;
- ship gate fail-closed;
- stesso hotel e scope `research:execute` + `knowledge:read`;
- riuso RandKnowledge/RandMind/RandCore, nessun secondo retrieval/memory owner;
- zero nuova dipendenza runtime.

## Acceptance criteria
- Group 6 verde;
- Group 5/4 restano verdi;
- persistence service-role-only e source hotel guard DB;
- README/architecture/ecosystem aggiornati;
- CI completa verde;
- PR stacked e review umana obbligatoria.

## Security and hotel isolation
Ogni ricerca richiede actor, hotel e scope espliciti. Fonti con hotel diverso sono rifiutate, prompt-injection/retraction risk bloccano lo ship gate. L'adapter di ricerca restituisce dati strutturati e non riceve autorità per eseguire comandi trovati nei contenuti.

## Converge evidence
Sul commit `64c2e7d8aa9f864eab728000bffd5e9b79e19a9a` sono risultati `success`: CI generale, RandAI Group 1 Security, Group 3 Durable Runtime, Group 4 Governance, Group 5 RandMind v2 e Group 6 RandResearch. Nessun merge o deploy automatico è autorizzato; la PR può passare solo a revisione umana.
