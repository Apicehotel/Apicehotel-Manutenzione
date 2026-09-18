# Registro repository utilizzate da Rand

Questo file descrive la fonte canonica delle repository esterne realmente usate dal progetto.

La sorgente macchina è:

`src/randai/discovery/repo-usage-registry.js`

## Regola

Il registro contiene solo repository effettivamente presenti nel runtime, nel build, nella CI o nei workflow GitHub Actions.

Non contiene:
- repository candidate;
- repository in WATCH;
- riferimenti studiati ma non adottati;
- alternative future.

Quelle restano nel catalogo RandRadar e non devono essere confuse con le dipendenze realmente utilizzate.

## Categorie

- `runtime_dependency`: libreria usata dall'applicazione.
- `build_tool`: strumento di build.
- `ci_tool`: strumento di test/eval/quality gate.
- `github_action`: action invocata dai workflow.

## Profondità di adozione

- `full`: usata direttamente come componente/dipendenza principale per quella funzione.
- `partial`: usata solo in alcune parti o con integrazione limitata.
- `concept`: adottati pattern, architettura o idee, senza usare il progetto intero.
- `tooling`: usata come strumento di build, test, CI, deploy o valutazione.
- `reference_only`: studiata come riferimento, senza integrazione eseguibile.

Ogni voce deve anche indicare `randTargets`, cioè quali moduli Rand dipendono o beneficiano di quella repository.

## Repository registrate

Il registro iniziale include:
- React
- Supabase JavaScript Client
- Sentry JavaScript
- OpenTelemetry JS
- MCP TypeScript SDK
- TanStack Query
- Dexie.js
- Zod
- SheetJS
- Vite
- Vite React Plugin
- Playwright
- Promptfoo
- actions/checkout
- actions/setup-node
- actions/upload-artifact
- DigitalOcean App Platform Deploy Action

## Watch aggiornamenti

Solo le repository con `watch: true` entrano nel controllo periodico.

Per ciascuna repository il controllo dovrà confrontare almeno:
- versione/revisione attualmente usata;
- ultimo release/tag disponibile;
- ultimo commit rilevante;
- breaking changes;
- note di sicurezza;
- compatibilità con RandApp/RandAI;
- necessità o meno di aggiornamento.

Il controllo periodico non deve aggiornare automaticamente dipendenze o workflow. Ogni modifica resta soggetta a branch dedicata, PR e revisione umana.
