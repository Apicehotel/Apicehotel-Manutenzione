# Change log — RandRadar architecture source

## Changes

### 2026-09-24

- Aggiunta `binhnguyennus/awesome-scalability` al catalogo RandRadar come fonte architetturale `REFERENCE_ONLY`.
- Formalizzata la classe umana `FONTE` e il suo boundary nella policy.
- Creato `RAND_ARCHITECTURE_PLAYBOOK_V1.md`.
- Aggiunti collegamenti in README e skill Repo Radar.
- Aggiunto regression test che impedisce auto-adozione e dipendenza runtime accidentale.
- Nessuna modifica a runtime, Supabase, database, Ocean o Vercel.
- Prima esecuzione CI: i test funzionali interessati risultano passanti; i workflow hanno fallito su `spec:validate` perché la prima bozza della spec non rispettava i heading/ID canonici. Questa revisione riallinea i quattro file al validatore RandSpec.
