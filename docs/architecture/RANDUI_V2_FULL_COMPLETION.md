# RandUI v2 — Full Completion Pass

## Obiettivo

Completare la UI di RandApp come sistema unico, senza trasformare le 24 pagine in 24 redesign indipendenti e senza introdurre un secondo design system.

La regola resta:

`Page Catalog → Template Registry → Foundation → Visual Language → Completion v2`

`completion-v2.css` viene caricato per ultimo ed è il guard condiviso finale. Le feature possono specializzare il contenuto, ma non devono riaprire problemi globali di geometria, overflow, safe-area, toolbar, azioni o modalità Grande.

## Consolidamento PR

La PR finale consolida direttamente su `main` la catena #219 → #222 → #223. Questo evita merge intermedi con una testa storicamente non certificata e forza la CI a verificare l'insieme completo contro `main` prima del merge umano finale.

## Perimetro

Il contratto si applica alle 24 destinazioni catalogate e ai 14 template RandUI.

Copre in modo condiviso:

- eliminazione del dead space verticale e dei contenitori che si stirano inutilmente;
- larghezza e contenimento del contenuto;
- header locali e PageTitle;
- toolbar, filtri, action row e form action;
- tabelle e contenuti orizzontali scrollabili senza overflow pagina;
- input/select/textarea bounded;
- reflow delle azioni sui telefoni;
- comportamento specifico <=430 px;
- tablet 768–1199 senza layout desktop prematuro;
- desktop >=1200 con sidebar stabile e contenuto allineato;
- modalità Grande con target tattili e spacing maggiorato;
- riduzione movimento;
- sidebar interna scrollabile senza far crescere l'intero viewport.

## Ownership

- `adaptive-layout.css`: geometria cross-device, safe-area e shell.
- `ui-coherence.css`: accessibilità e comportamento dei controlli.
- `visual-language.css`: gerarchia visiva e primitive condivise.
- `completion-v2.css`: ultimo guard di composizione/responsive per le pagine migrate.

Il completion layer non definisce una nuova palette, un nuovo set di componenti o un nuovo framework.

## Mobile

Su telefono:

- il contenuto usa il 100% del contenitore, non viewport hacks;
- header locali diventano verticali quando serve;
- le azioni occupano tutta la larghezza e sotto 430 px diventano una per riga quando necessario;
- toolbar e filtri possono reflow senza clipping;
- tabelle e contenuti larghi scrollano dentro il proprio contenitore e non spostano la pagina;
- l'aside viene dopo il contenuto principale;
- touch target resta governato da `--rs-adaptive-touch-min`.

## Tablet

Tra 768 e 1199 px RandUI mantiene il layout touch/tablet e non anticipa la sidebar desktop. I template compact mantengono ritmo controllato e toolbar/filtri restano leggibili.

## Desktop

Da 1200 px:

- sidebar stabile;
- contenuto page-boundary allineato all'inizio;
- azioni locali restano sulla destra solo quando c'è spazio reale;
- nessuna pagina può introdurre overflow orizzontale globale come soluzione a tabelle o filtri.

## Grande mode

La modalità Grande non è solo text zoom. Il completion layer mantiene titolo più leggibile, spaziatura delle action row più ampia e target di controllo coerenti con il minimo adattivo.

## Anti-regressione

`test/randui-v2-full-completion.test.js` protegge:

- 24 pagine / 14 template;
- ordine degli import, con completion caricato dopo visual language;
- copertura mobile/tablet/desktop;
- modalità Grande;
- dead-space e overflow guards;
- assenza di `100vw` nel completion layer;
- assenza di grandi min-height arbitrarie;
- assenza di `!important` nel nuovo layer;
- assenza di framework/design system aggiuntivi.

Il test è incluso in `npm run test:randui` e quindi nel gate RandUI della CI canonica.

## Regola futura

Una pagina può definire il proprio contenuto operativo, ma prima di aggiungere CSS locale per layout deve verificare se la regola appartiene a RandUI. Se la regola è comune a due o più famiglie di pagina, deve essere risolta nel proprietario canonico invece che duplicata.

Nessuna modifica agente può entrare in `main` senza branch, test, CI e revisione umana secondo RandFlow.
