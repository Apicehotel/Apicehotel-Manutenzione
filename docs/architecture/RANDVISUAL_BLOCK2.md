# RandVisual — Blocco 2

## Scopo

RandVisual è il motore visuale governato dell'ecosistema Rand. Non sostituisce RandUI e non introduce un secondo design system: produce diagrammi, SVG, infografiche, procedure visuali e piani per immagini generative partendo da dati già autorizzati e hotel-scoped.

## Prima di questo blocco

Il repository possedeva già il nucleo corretto di RandVisual: contratti, layout, renderer SVG sicuro, isolamento per hotel, fingerprint/provenienza e integrazione RandCore. Per questo il Blocco 2 estende il modulo esistente invece di crearne uno parallelo.

## Fonti esterne governate

### `cathrynlavery/diagram-design`

Classificazione: `ADAPT`.

Uso consentito: grammatica editoriale, gerarchia, leggibilità, accessibilità e pattern per diagrammi. Non viene installato come dipendenza runtime e non esegue codice remoto.

### `freestylefly/awesome-gpt-image-2`

Classificazione: `SOURCE_ONLY`.

Uso consentito: tassonomia, idee e pattern per costruire prompt visuali. I prompt/casi di terzi non vengono copiati automaticamente. Ogni uso commerciale richiede verifica dei diritti applicabili al materiale di riferimento. Non viene installato nel runtime e non esegue codice remoto.

Il registro canonico vive in `src/randai/visual/sources.js`.

## Pipeline

### Diagrammi e visuali strutturati

`dati autorizzati -> RandVisual contract -> layout -> renderer SVG sicuro -> fingerprint/provenienza -> output`

Il motore SVG esistente rimane il proprietario canonico.

### Immagini generative

`objective + hotelId -> RandVisual image plan -> minimizzazione/redazione dati -> provider immagini approvato -> bozza -> review/approvazione`

L'image plan non esegue generazione da solo. Definisce boundary, provenienza, diritti, privacy e autorità dell'output. L'output resta `DRAFT_UNTIL_USER_OR_WORKFLOW_APPROVAL`.

## Regole invariabili

- `hotelId` obbligatorio per i piani immagine.
- Nessuna fonte esterna diventa dipendenza runtime solo perché è registrata in RandRadar/RandVisual.
- Nessuna esecuzione remota delle repository fonte.
- Nessuna copia automatica dei prompt di casi di terzi.
- Dati sensibili: minimizzazione e redazione prima del rendering/generazione.
- RandUI resta il design system dell'app; RandVisual produce artefatti visuali, non layout applicativi.
- RandCore/RLS/RPC restano autorità per permessi e dati.
- Output generativi = bozza finché non approvati.

## Connessioni previste

RandVisual può essere consumato da:

- RandGuide / Procedure per procedure visuali;
- RandAI per spiegazioni e diagrammi contestuali;
- RandCore per health, worker, permessi, deployment, database e Repo Radar;
- Planning e report per rappresentazioni sintetiche;
- RandRadar come fonte di governance e valutazione delle repository visuali.

Ogni integrazione deve riusare il gateway e i contratti esistenti, non creare renderer paralleli.

## Test

`test/randvisual-block2-sources.test.js` protegge:

- registro sorgenti governato;
- divieto di dipendenze runtime;
- divieto di remote execution;
- ruolo `ADAPT`/`SOURCE_ONLY`;
- hotel scope dei piani immagine;
- minimizzazione dei dati sensibili;
- output in stato bozza;
- obbligo di provenance e verifica diritti.

## Decisione zombie

Durante l'implementazione è stato creato un primo `policy.js`. Il confronto con il codice preesistente ha mostrato che duplicava responsabilità già presenti in contracts/engine/renderer. È stato rimosso e sostituito dal più ristretto `sources.js`, che contiene soltanto la governance mancante delle fonti esterne e della pipeline immagini.

Questo mantiene la regola: un solo proprietario canonico per capacità.
