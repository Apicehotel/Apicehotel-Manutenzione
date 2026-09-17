# RandUI Standardization v1

## Obiettivo

La rebuild RandUI v1 resta il design system canonico. Questo blocco aggiunge portabilità e governance senza introdurre un secondo runtime: token, motion e icone hanno un contratto unico verificabile.

## Contratti

- `src/randapp/randui/design-tokens.json`: token portabili DTCG-compatible per spacing, radius, layout/touch e motion.
- `src/randapp/randui/motion-contract.js`: durate/easing canonici; `prefers-reduced-motion` azzera la durata.
- `src/randapp/randui/icon-contract.js`: nomi semantici e adapter unico. L'owner runtime resta `src/randapp/ui.jsx#Icon`.
- `test/randui-standardization-v1.test.js`: gate anti-regressione incluso in `npm test`.

`RANDUI_VERSION` resta `1.0.0`; `RANDUI_STANDARDIZATION_VERSION` evolve separatamente per non rompere il contratto della rebuild.

## Tool esterni

- Penpot/Figma/M3E Canvas: design e prototipazione, non runtime.
- MingCute: target iconografico approvato; migrazione solo adapter-first e atomica.
- Anime.js: eventuale motore motion solo se riduce complessità/bundle; non viene aggiunto per duplicare le transizioni esistenti.
- EaseMaster: authoring delle curve, non dipendenza runtime.
- SkillUI/ScreenCoder: fonti di analisi/baseline, nessuna scrittura diretta su `main`.

## Flusso target

`Design → token canonici → RandUI → quality gate → browser/device → preview → review umana`

## Zombie policy

`src/randapp/randui-v2/` e `/ui-v2-preview` restano vivi finché runtime, CI o Ocean li referenziano. Una rimozione richiede contemporaneamente zero import runtime, zero route/gate, zero riferimenti CI e un sostituto verificato.

## Evoluzione

Una soluzione esterna migliore sostituisce l'owner canonico dietro il relativo adapter/contract. Non si aggiungono sistemi paralleli per shell, token, icone o motion.
