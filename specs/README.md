# RandSpec workspace

RandSpec è il livello spec-driven del RandFlow canonico.

## Quando serve
Usare una spec per feature, refactor architetturali, schema/RLS, nuovi worker/scheduler, integrazioni, modifiche di permessi, nuove capability AI/MCP/skill e cambi UI sostanziali.

Fix banali o sola documentazione possono usare `RANDSPEC: N/A` nella PR con motivazione, purché non cambino boundary o comportamento sostanziale.

## Creazione
Copia `specs/_template` in `specs/<NNN-slug>` e completa nell'ordine:
1. `spec.md`;
2. `plan.md`;
3. decisione RandRadar nel plan;
4. `tasks.md`;
5. implementazione;
6. `change-log.md` ogni volta che cambia un requisito;
7. converge e release gate.

## Stati task
Solo `TODO`, `DOING`, `BLOCKED`, `DONE`, `CANCELLED`.

`DONE` richiede evidenza; `BLOCKED` richiede causa; `CANCELLED` richiede decisione nel change log.

## Comandi
```bash
npm run spec:validate
npm run test:randspec
```
