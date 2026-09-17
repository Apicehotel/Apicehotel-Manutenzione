# RandUI Standardization v1

Stato: implementato su branch `feat/randui-standardization-v1`.

## Obiettivo

RandUI rebuild v1 ha già unificato shell, template, responsive geometry e 24 destinazioni. Questo blocco non crea un secondo design system: rende la base esistente portabile e verificabile per Penpot/Figma, web, futuri client Android/iOS e agenti di sviluppo.

## Contratti canonici

### Design token

`src/randapp/randui/design-tokens.json` è il contratto portabile in forma DTCG-compatible. Contiene spacing, radius, layout/touch target e motion. Il runtime CSS resta compatibile con le variabili RandUI esistenti; non viene introdotto un secondo tema.

Regola: un nuovo token nasce nel contratto canonico e viene poi proiettato nei target. Non si aggiungono valori arbitrari pagina per pagina quando esiste già un token equivalente.

### Motion

`src/randapp/randui/motion-contract.js` definisce durate ed easing canonici e azzera la durata quando è attivo `prefers-reduced-motion`.

Le animazioni future devono passare da questo contratto. Anime.js può essere adottato in seguito come motore solo se riduce complessità e bundle; EaseMaster resta uno strumento di authoring delle curve, non una dipendenza runtime.

### Icone

`src/randapp/randui/icon-contract.js` introduce nomi semantici e un solo adapter. Il runtime attuale resta `src/randapp/ui.jsx#Icon` per non rompere le schermate esistenti. MingCute è il target approvato per una migrazione futura adapter-first.

Regole: niente emoji come icone UI, `currentColor`, icone decorative nascoste all'accessibility tree, controlli icon-only con label accessibile, Regular di default e Filled per stato attivo quando il target lo supporta.

## Gate

`test/randui-standardization-v1.test.js` protegge:

- presenza e forma dei token canonici;
- touch target minimo;
- reduced motion;
- ownership unica motion/icon;
- adapter iconico semantico;
- permanenza di `/ui-v2-preview` finché il gate Ocean la usa.

Il test entra automaticamente in `npm test` tramite il glob `test/*.test.js`.

## Penpot, M3E Canvas e tool esterni

Penpot è approvato come candidato per il master design tecnico grazie ai token DTCG e al modello web-native. M3E Canvas resta uno strumento rapido di prototipazione. Nessuno dei due diventa un secondo runtime RandUI.

Flusso target:

`Penpot/Figma/M3E Canvas -> design-tokens.json -> RandUI -> quality gate -> Playwright/device -> preview -> review umana`

SkillUI e ScreenCoder possono produrre evidenza o baseline, non scrivere direttamente `main`.

## Parti zombie

Nessuna parte RandUI viene eliminata per semplice somiglianza. In particolare `src/randapp/randui-v2/` e `/ui-v2-preview` restano vive finché Ocean/CI le usano. La rimozione richiede contemporaneamente: zero import runtime, zero riferimenti CI, zero route/gate e sostituto verificato.

## Regola di evoluzione

Quando una soluzione esterna è realmente migliore, si sostituisce l'owner canonico dietro il relativo adapter/contract. Non si aggiungono librerie parallele per icone, motion, shell, token o componenti.
