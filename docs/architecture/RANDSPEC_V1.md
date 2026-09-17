# RandSpec v1 — Spec-driven governance sopra RandFlow

## Decisione
GitHub Spec Kit viene adottato come **pattern SOURCE_ONLY**, non come dipendenza runtime o secondo lifecycle. RandApp è brownfield, possiede già RandFlow, RandCore release gate, RandRadar e una Quality Matrix estesa: introdurre una seconda CLI/governance creerebbe overlap.

**RandSpec estende RandFlow**: non lo sostituisce e non crea una seconda autorità. Porta nel sistema esistente quattro concetti mancanti o non formalizzati abbastanza: SPECIFY, artefatti persistenti SPEC/PLAN/TASKS, change protocol e CONVERGE.

## Ownership canonica
- RandFlow: lifecycle di esecuzione e freeze agenti.
- RandSpec: contratto di intent/plan/task/change per ogni lavoro sostanziale.
- RandRadar: discovery e valutazione build-vs-reuse durante PLAN.
- RandCore: security, CI, health e release gate.
- RandUI/RandMind/RandSkills/etc.: owner di dominio già esistenti.

## Struttura
Ogni lavoro sostanziale vive in `specs/<id-slug>/`:
- `spec.md` — cosa deve essere vero, outcome e acceptance criteria;
- `plan.md` — come cambiare il sistema rispettando owner e boundary;
- `tasks.md` — task atomici e verificabili;
- `change-log.md` — delta requisiti/decisioni dopo l'avvio.

`specs/_template/` contiene i template canonici.

## Regole brownfield
1. niente riscrittura di moduli esistenti solo per aderire a RandSpec;
2. le nuove modifiche sostanziali entrano progressivamente nel lifecycle;
3. i lavori preesistenti restano validi, ma quando vengono riaperti in modo sostanziale ricevono una spec;
4. una spec non sostituisce test, RLS, audit o CI.

## RandRadar nel PLAN
Prima di introdurre dipendenze, framework, database, agent runtime, scheduler, component library o nuovi owner, il plan deve registrare la decisione RandRadar: `KEEP`, `ADAPT`, `ADD`, `REPLACE`, `WATCH` o `REJECT`, con motivazione e licenza.

## Converge
Prima di dichiarare `READY_FOR_HUMAN_MERGE` si confrontano:
- acceptance criteria in `spec.md`;
- decisioni/rollback in `plan.md`;
- task in `tasks.md`;
- codice, test, security e docs realmente presenti.

Un test verde non compensa un acceptance criterion mancante. Un task può essere `DONE` solo con evidenza verificabile.

## Validazione
`npm run spec:validate` è fail-closed su:
- file obbligatori mancanti;
- heading minimi mancanti;
- task senza stato valido;
- spec con ID non coerente con la directory;
- placeholder obbligatori lasciati nei lavori reali.

`npm run test:randspec` protegge Constitution, template, integrazione RandFlow e CI.

## Non-obiettivi
- nessun database nuovo;
- nessun servizio esterno;
- nessun bypass della branch protection;
- nessuna auto-installazione da RandRadar;
- nessun merge/deploy automatico;
- nessuna duplicazione del release gate RandCore.
