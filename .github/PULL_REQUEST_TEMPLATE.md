## RandSpec
- RANDSPEC: <!-- specs/<id-slug> oppure N/A con motivazione -->
- Change type: <!-- feature | fix | refactor | security | docs | ops -->

## Cosa cambia
<!-- Sintesi minima e coerente. -->

## Canonical owner / boundary
<!-- Quale owner Rand resta autoritativo? Hotel/RLS/permission impact? -->

## RandRadar
- Decision: <!-- KEEP | ADAPT | ADD | REPLACE | WATCH | REJECT | N/A -->
- External source/dependency: <!-- nome + licenza oppure NONE -->

## Evidence
- [ ] RandSpec valida (`npm run spec:validate`) oppure N/A motivato
- [ ] Test pertinenti verdi
- [ ] Security/dependency gate pertinente verde
- [ ] Multi-hotel/RLS verificato oppure N/A
- [ ] RandUI/browser/device verificato oppure N/A
- [ ] README/docs aggiornati oppure N/A
- [ ] Zombie check eseguito; nessuna rimozione per supposizione
- [ ] Rollback definito per cambi rischiosi
- [ ] Zero unresolved critici nel perimetro

## Freeze agenti
- [ ] Nessun push/merge/deploy agente diretto su `main`
- [ ] Nessun deploy produzione automatico introdotto
- [ ] Merge lasciato a revisione/approvazione umana

## Note / unresolved
<!-- NONE se non ce ne sono. -->
