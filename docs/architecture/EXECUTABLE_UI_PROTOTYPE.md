# RandApp Executable UI Prototype

Questa prova sostituisce il precedente mockup puramente visivo con un contratto eseguibile: ciò che viene mostrato deve avere una funzione reale o un fallback verificabile nella RandApp corrente.

## Sorgenti realmente usate

- **LiquidGlass-UI — hwyuanzi/LiquidGlass-UI (MIT):** i token del materiale, blur/saturazione, fallback progressivi e media query di accessibilità sono vendorizzati in `src/randapp/vendor/liquid-glass-ui.css`. RandApp applica poi i propri token hotel/theme nel foglio `prototype-liquid-dock.css`.
- **Tabler Icons (MIT):** il dock usa i path SVG reali di `plus`, `tool`, `calendar-event`, `package` e `sparkles`, mantenuti inline per evitare una seconda dipendenza runtime durante il test.

Konsta UI e Motion Primitives restano riferimenti di comportamento per sheet, touch target e motion; non vengono dichiarati come dipendenze installate. Tremor non viene usato in questo slice perché il dock non visualizza KPI o grafici. Nessuna libreria viene aggiunta solo per poter dire che è stata usata.

## Contratto del dock

Su mobile (`<960px`) la bottom navigation resta a cinque slot: `Segnalazioni · Interventi · Home · Planning · Magazzino`. Home resta nello slot 3. Il Menu non occupa uno slot visibile ed è raggiungibile tramite il gesto orizzontale previsto dalla shell.

Il dock sopra la navbar espone due ingressi reali: `Nuovo` e `RandAI`. Il pull-up usa Pointer Events e apre lo stesso pannello di azioni rapide. Swipe verso il basso, backdrop ed Escape lo chiudono. I click restano sempre disponibili come fallback.

Le azioni non sono demo:

- `Nuova segnalazione` apre l'InsertLauncher reale e seleziona `issue`;
- `Nuovo intervento` apre l'InsertLauncher reale e seleziona `intervention`;
- `Planning` richiama la destinazione Planning esistente;
- `Magazzino` richiama la destinazione Inventory esistente;
- `RandAI` invia l'evento `randai-toggle` al RandAI già autenticato e contestuale.

Il mockup mostrava anche “Scarico da magazzino”; non è stato inserito nel codice perché non esiste ancora come azione shell equivalente. La regola è: nessuna funzione finta per ottenere fedeltà grafica.

## Liquid Glass e fallback

Il vetro è riservato a chrome, dock, navbar e sheet; i contenuti operativi restano leggibili. Sono previsti:

- `backdrop-filter` + `-webkit-backdrop-filter` per Safari;
- fallback solido quando il blur non è supportato;
- `prefers-reduced-motion`;
- `prefers-reduced-transparency`;
- contrasto aumentato e `forced-colors`;
- tema chiaro/scuro e accento della struttura tramite i token `--rs-*` esistenti.

## Regola mockup → codice

Una schermata può essere presentata come target RandApp solo quando ogni controllo mostrato è mappato a una funzione reale, un componente già implementato o una modifica tecnicamente verificata. Gli elementi puramente illustrativi devono essere esplicitamente marcati come concept e non possono essere confusi con il target eseguibile.
