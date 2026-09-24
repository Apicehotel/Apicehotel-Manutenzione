# Plan — RandRadar architecture source

## Canonical owners

- RandRadar: discovery, catalogo e classificazione.
- RandCore: health, retry/dead-letter evidence e governance operativa.
- RandGateway/RandSecure/Action Gateway/RandAudit: boundary delle azioni.
- Supabase: source of truth operativa.
- `docs/architecture/RAND_ARCHITECTURE_PLAYBOOK_V1.md`: unico owner dei pattern architetturali derivati da fonti curate.

## Current state

RandRadar dispone già di catalogo, discovery multisorgente, gate di adozione e classe umana `FONTE`, ma la policy non descriveva ancora in modo esplicito come trattare una fonte architetturale permanente. Awesome Scalability non era presente nel catalogo e non esisteva un playbook Rand dedicato.

## Proposed change

Aggiungere Awesome Scalability al catalogo curato come `REFERENCE_ONLY`, formalizzare il comportamento `FONTE`, creare il playbook con pattern minimi e anti-pattern, collegare README/skill e aggiungere un test anti-regressione.

## RandRadar decision

**FONTE**. Runtime interno: **WATCH** intenzionale. Non è una capability da installare; è evidenza architetturale da consultare e adattare. Nessun benchmark gate viene auto-approvato.

## Rollback

Rimuovere l'entry `awesome-scalability`, il playbook e i riferimenti documentali/test introdotti da questa spec. Nessun rollback dati o infrastrutturale è necessario perché non vengono modificati runtime, database o deploy.

## Tests and evidence

- `npm run spec:validate`
- `npm run test:repo-radar`
- CI completa della PR
- workflow Repo Radar
- verifica che `package.json` non introduca dipendenze
- verifica diff branch vs `main`

## Zombie check

Non viene creato un secondo sistema. Il playbook è collegato da README, skill e policy; la fonte è referenziata dal catalogo e protetta da test. Eventuali fonti future devono convergere nello stesso playbook invece di creare documenti paralleli.
