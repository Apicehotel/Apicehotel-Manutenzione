# RandUI Visual Language v1

## Scopo

RandUI Core, Guard e Page Migration hanno già unificato struttura, template e controllo delle pagine. Visual Language v1 chiude il livello successivo: la gerarchia visiva interna delle famiglie di template.

La catena canonica diventa:

`Page Catalog → Template → Visual Policy → RandUI primitives → domain content → Guard`

Non viene introdotto un secondo design system e non viene modificata la logica di dominio.

## Visual Policy per template

Ogni template dichiara due proprietà obbligatorie nel `template-registry.js`:

- `width`: `wide`, `reading` oppure `center`;
- `rhythm`: `compact`, `normal` oppure `comfortable`.

Queste proprietà vengono stampate da `TemplateFrame` come `data-randui-width` e `data-randui-rhythm` e vengono interpretate da `randui/visual-language.css`.

La scelta non è lasciata alla singola pagina. Una nuova pagina eredita quindi larghezza e ritmo dalla propria famiglia di template.

## Primitive visuali canoniche

`src/randapp/randui/visual-primitives.jsx` espone cinque primitive di pagina registrate nel Component Registry:

- `PageTitle` — titolo, descrizione, eyebrow e azione locale;
- `Surface` — pannello/superficie coerente;
- `Stack` — ritmo verticale;
- `Grid` — griglia responsive dichiarativa;
- `Metric` — KPI/metrica compatta.

Le primitive non sostituiscono i componenti di dominio. Evitano invece che le pagine ridefiniscano ogni volta margini, griglie, pannelli e gerarchia.

## Ownership CSS

`randui/foundation.css` resta il layer finale e importa, nell'ordine:

1. `adaptive-layout.css` — geometria responsive;
2. `ui-coherence.css` — interazione/accessibilità;
3. `visual-language.css` — ritmo, gerarchia e primitive visuali interne.

Il vecchio `src/randapp/migrated.css` è stato eliminato: le regole ancora vive sono state assorbite in `visual-language.css`, mentre i selettori `rs-legacy` non avevano più consumer dopo Block 3.

## Prima famiglia completamente ripulita

Planning è il primo consumer completo del linguaggio visuale:

- `PlanningHub.jsx`;
- `PlanningWorkSimple.jsx`;
- `PlanningSaleSimple.jsx`;
- `planning/PlanningOverview.jsx`.

La geometria page-level di questi file non usa più `style={{...}}`; passa da primitive e classi RandUI. Le modali e i form di dominio possono ancora possedere layout locale quando strettamente specifico, ma non possono diventare una seconda grammatica di pagina.

## Regola per il futuro

Una nuova pagina o una rifinitura deve seguire questo ordine:

1. scegliere/risolvere il template dal Page Catalog;
2. usare la Visual Policy del template;
3. usare primitive RandUI per titolo, stack, grid, superfici e metriche;
4. mantenere CSS locale soltanto per semantica realmente di dominio;
5. passare `npm run test:randui:visual`, RandUI Guard, browser e device acceptance.

Non si aggiunge un nuovo framework UI solo per ottenere spacing, card o layout già coperti dal sistema. RandRadar resta disponibile quando esiste un gap reale, non per duplicare capacità interne.

## Test

`npm run test:randui:visual` verifica:

- Visual Policy su tutti i 14 template;
- registrazione delle cinque primitive;
- metadata width/rhythm nel `TemplateFrame`;
- ownership di `visual-language.css` da parte della Foundation;
- assenza di geometria inline nei top-level Planning;
- uso del `PageTitle` canonico nelle utility views;
- impossibilità di reintrodurre `migrated.css`.

Il test è incluso anche in `npm run test:randui` e quindi nella CI completa.
