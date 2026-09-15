# RandDesignBridge v1

RandDesignBridge collega Figma e RandUI senza creare un secondo design system, un secondo owner dei componenti o una pipeline autonoma capace di scrivere direttamente su `main`.

## Decisione architetturale

`RandUI` resta la fonte canonica lato codice. Il bridge serve a leggere/scrivere design, trasferire contesto agli agenti, sincronizzare token quando verificato e confrontare l'implementazione con il design.

Flusso governato:

```text
Figma
  ↓
RandDesignBridge
  ├─ Figma MCP ufficiale (primario)
  ├─ context adapter opzionale
  ├─ token adapter build-time
  ├─ reverse-import sandbox
  └─ visual evidence
  ↓
RandUI / component registry
  ↓
feature branch
  ↓
test + visual gate + OpenCodeReview/CI
  ↓
review umana
  ↓
main
```

## Scrematura applicata

### Primario

- **Figma MCP ufficiale**: unico bridge primario. Non viene sostituito da un MCP di terze parti.

### Pattern/adapters utili

- **Framelink / Figma Context MCP**: pattern di compressione del contesto Figma per coding agent. Adapter locale opzionale.
- **Tokens Studio / Style Dictionary transforms**: pattern DTCG per token. Nessun secondo owner dei token finché il round-trip non è verificato.

### Sandbox

- **figma-console-mcp**: capacità molto ampie; utile per benchmark, ma sovrapposto al MCP ufficiale e quindi sandbox-only.
- **Image To Figma Layers**: reverse design da screenshot; l'output non diventa mai canonico senza revisione.

### Deferred intenzionali

- **Figma Code Connect**: viene attivato solo quando piano/seat Figma e libreria componenti pubblicata soddisfano i requisiti ufficiali. Il repository viene già preparato concettualmente per il mapping, ma non introduce una dipendenza inutilizzabile.
- **Storybook Figma Sync**: non si introduce Storybook soltanto per ottenere il confronto Figma. RandUI possiede già Playwright, test visuali e device acceptance. Si rivaluta solo se Storybook diventa uno strumento canonico del progetto.

### Reference-only

- **FigmaToCode**: utile per scaffold, non per produrre codice finale senza adattamento a RandUI.
- **Builder.io figma-html**: utile come pattern web/HTML→Figma, ma Builder.io non diventa una dipendenza obbligatoria.
- **figma-to-flutter storico**: riferimento soltanto; non adatto come dipendenza production corrente.

## Perché non installiamo tutto

Installare sette strumenti sovrapposti sarebbe contrario al contratto Rand: aumenterebbe dipendenze, superfici di sicurezza e probabilità di codice zombie. Ogni capacità deve avere un owner unico.

La regola è:

- un solo MCP Figma primario;
- adapter opzionali soltanto quando aggiungono una capacità misurabile;
- nessuna generazione Figma→codice può bypassare branch, test e review;
- nessun reverse-import può sovrascrivere componenti/token canonici automaticamente.

## Visual regression

Il percorso v1 riusa i gate già presenti:

- `test/randui-visual-language-v1.test.js`;
- `test/e2e.mjs`;
- `test/device-acceptance.mjs`;
- Playwright/WebKit per le verifiche mobile sensibili.

Storybook non è richiesto per dichiarare il bridge operativo. Se in futuro entra come catalogo canonico dei componenti, il confronto pixel-level Figma↔Storybook può essere aggiunto senza sostituire i gate esistenti.

## Design token

Qualunque export/import futuro deve usare un formato DTCG-compatible o un mapping esplicito, versionato e reversibile. `src/randapp/randui/foundation.css`, il component registry e il design contract restano le evidenze canoniche finché non viene introdotto un round-trip verificato.

## Stato v1

- RandUI canonico: **READY**.
- Figma bridge primario: **external/configuration dependent**.
- Code Connect: **DEFERRED** finché i prerequisiti Figma non sono soddisfatti.
- Visual regression: **READY** usando i gate Playwright esistenti.
- Storybook: **NOT REQUIRED**.
- Tool MCP terzi con capacità di scrittura: **SANDBOX ONLY**.

Comandi:

```bash
npm run design:check
npm run test:design
```

Il check genera `artifacts/randdesign/latest.json` senza introdurre nuove dipendenze runtime.

## Zombie policy

Un tool Figma viene eliminato/declassato quando:

1. duplica una capacità già coperta dal bridge primario;
2. non è più mantenuto e non fornisce un pattern unico;
3. richiede infrastruttura che non porta beneficio misurabile;
4. introduce un secondo design-system owner;
5. non è compatibile con il freeze agenti o con la review umana obbligatoria.

La rimozione di un adapter già usato richiede prima verifica di riferimenti, CI e dipendenze; nessun file viene cancellato soltanto perché un tool è stato declassato in RandRadar.
