# RandAI Contextual Integration — Punto 3 finale

## Obiettivo

RandAI deve comportarsi come parte nativa di RandApp, non come chat separata che richiede di riscrivere informazioni già note all'app.

## Contratto finale

1. `RandAIContextBridge` viene montato solo quando esiste una sessione RandApp autenticata.
2. Il bridge pubblica un `RandAIContextEnvelope` con struttura attiva, utente della sessione e schermata operativa corrente.
3. Se una feature pubblica un contesto più ricco con una risorsa attiva, il bridge non lo sovrascrive. Oggi il caso principale è la Segnalazione aperta, che aggiunge issue ID, camera/zona, categoria, stato, urgenza, riepilogo, stato camera e presenza foto.
4. `retrieveRandAIGuidance` continua a usare un solo contratto: `operationalContext` esplicito oppure `getRandAIContext()` come contesto corrente. Non viene introdotto un secondo context store.
5. Il `+` globale contiene `Chiedi a RandAI`, oltre alle azioni di creazione. Questa voce apre l'assistente mantenendo il contesto già pubblicato.
6. L'header mantiene il Cyber Cat Orb come accesso rapido. Il `+` e l'header aprono lo stesso assistente e lo stesso runtime.
7. Le azioni che modificano dati restano fuori dalla chat libera e continuano a passare dall'Action Gateway con permessi, conferma, verifica e audit.

## Perché non è stato aggiunto un framework esterno

Il repository possiede già Operational Context Envelope, Context Engine, memoria, Action Gateway, workspace persistente e retrieval contestuale. Aggiungere un altro agent framework o un secondo context provider avrebbe duplicato stato e policy. Il Punto 3 collega i moduli già maturi invece di sostituirli.

## Fallback schermata

Lo stato della schermata viene ricavato dalla navigazione attiva della shell (`aria-current` sulla bottom navigation o item attivo della sidebar). Il bridge ascolta anche `randapp-view-changed`, così una futura emissione esplicita dalla shell potrà diventare la fonte primaria senza cambiare il contratto RandAI. La risorsa operativa pubblicata dalle feature ha sempre precedenza.

## Privacy e scope

Il contesto globale minimo contiene solo `hotelId`, `userId` e view. Non aggiunge PIN, token, email, telefono o altri dati personali. Le feature possono aggiungere solo i campi operativi previsti dall'envelope normalizzato.

## Test

`test/randai-contextual-integration.test.js` protegge:

- mount autenticato bridge + assistant;
- pubblicazione hotel/actor/view;
- precedenza del resource context;
- accesso RandAI dal launcher globale;
- consumo del context corrente da `retrieveRandAIGuidance`.

Il Punto 3 è accettato solo con Quality Matrix, Critical Gate, Multi-hotel, build, bundle budget, suite completa, Chromium/WebKit e device acceptance verdi.