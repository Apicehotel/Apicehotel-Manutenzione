# RandUI Telegram-inspired Navigation v1

## Obiettivo

RandApp adotta una navigazione ispirata ai principi di Telegram — chiarezza, gerarchia stabile, densità controllata e accesso rapido — senza copiarne branding o componenti e senza introdurre un secondo design system.

## Contratto mobile

La bottom navigation usa cinque posizioni spaziali stabili:

1. **Operatività** — hub autorizzato per Segnalazioni e Interventi;
2. **Planning** — lavori e sale restano workflow distinti sotto lo stesso dominio;
3. **Home** — sempre geometricamente centrale;
4. **Destinazione rapida** — RandChat quando autorizzata, altrimenti una funzione operativa autorizzata ordinata dal sistema adattivo già esistente;
5. **RandAI** — sempre all'estrema destra come azione globale dell'assistente.

`Altro` non è più una destinazione primaria. Il menu completo si apre dal controllo profilo/nome nell'header.

Gli slot sono posizionati esplicitamente tramite `data-slot`: una destinazione non autorizzata può mancare senza spostare Home fuori dal centro o RandAI dalla posizione 5.

## Operatività hub

`operations` è una pagina RandUI `operational`, registrata nel Page Catalog e protetta da `VIEW_GUARDS`.

L'hub non fonde i domini:

- **Segnalazioni** continua a usare route, permessi, creazione, filtri e dettaglio esistenti;
- **Interventi** continua a usare route, permessi, assegnazione e risoluzione esistenti.

L'hub è soltanto una superficie di orientamento. Ogni destinazione viene mostrata soltanto quando `viewAllowed(...)` la autorizza.

## Drawer profilo

Il drawer è la navigazione completa autorizzata. Si apre da:

- pulsante profilo/nome in alto;
- swipe dal bordo sinistro già supportato dalla Shell.

Le sezioni derivano da `buildNav()` e sono accordion accessibili (`aria-expanded`, `aria-controls`). La sezione che contiene la destinazione corrente viene aperta automaticamente.

Gruppi correnti:

- Principale;
- Operatività;
- Gestione e controllo;
- Profilo e guida;
- Sistema;
- Amministrazione, quando autorizzata.

Il drawer riceve tutte le voci non `off`; non esclude più le voci configurate come bottom navigation.

## Header

Il controllo profilo è il proprietario del menu. Il chip struttura torna ad avere una sola responsabilità: cambiare hotel quando più strutture sono autorizzate.

RandAI resta accessibile anche da desktop tramite il CyberCat dell'header; su mobile il controllo duplicato viene nascosto perché RandAI possiede lo slot 5.

## Visual grammar

`src/randapp/telegram-navigation.css` usa esclusivamente token `--rs-*` e le primitive RandUI correnti. Non introduce dipendenze UI.

Principi:

- superfici leggere e non invasive;
- stato attivo con tinta morbida, non indicatori luminosi ridondanti;
- avatar circolare e righe menu compatte;
- target touch >= 44 px;
- focus visibile;
- layout verificabile a 320 px;
- rispetto di light/dark theme e densità Piccolo/Normale/Grande.

## RandRadar

Per questa fase RandRadar non ha evidenziato un gap tecnologico che giustifichi una nuova libreria. Registry, Shell, Adaptive Layout, RandUI primitives e Playwright coprono già il problema. Aggiungere un secondo framework di navigazione avrebbe aumentato dipendenze, incoerenza e rischio di regressione.

Regola: **discover broadly, adopt narrowly**. Una repository esterna entra solo se sostituisce chiaramente una capacità interna più debole.

## Estensioni predisposte

Il contratto consente senza rifare la Shell:

- badge reali per notifiche o code operative;
- preferiti per ruolo/utente;
- ricerca nel drawer;
- nuove famiglie di moduli;
- nuove policy di ranking dello slot 4;
- collegamento di RandAI a contesto pagina;
- metriche dell'hub Operatività quando saranno disponibili da una fonte reale.

Nessun numero, percentuale o badge viene simulato nella UI.

## Gate

Comando dedicato:

```bash
npm run test:randui:telegram
```

Il gate verifica:

- Home slot 3;
- RandAI slot 5;
- assenza di `Altro` dal contratto primario;
- Operatività hub e permessi figli;
- menu profilo + accordion accessibili;
- RandAI come azione globale e non pagina duplicata;
- uso dei token RandUI e touch target.
