# RandApp App Shell Foundation

## Stato

Questo documento descrive il contratto corrente RandUI v1. La precedente fondazione separata è stata assorbita: `src/randapp/app-shell-foundation.css` non esiste più e non deve essere reintrodotto.

## Obiettivo

RandApp usa una sola chrome autenticata su iOS/iPadOS, Android, tablet e Windows. `src/randapp/Shell.jsx` possiede sidebar, header, bottom navigation, drawer e azioni globali. Le pagine di dominio non creano una seconda navigazione applicativa.

## Navigazione mobile e tablet

La bottom navigation ha cinque slot stabili:

- Home resta nello slot `3`;
- Altro/Menu resta nello slot `5`;
- gli slot `1`, `2` e `4` vengono assegnati soltanto a destinazioni autorizzate, ordinate per interessi/configurazione di ruolo;
- interessi e preferenze possono cambiare priorità, mai concedere permessi.

Il contratto è in `src/randapp/shell-navigation.js`, `src/randapp/role-navigation.js` e `src/randapp/adaptive-layout.js`.

Il FAB `+` è un'azione contestuale e non una destinazione di navigazione. Quando una pagina come Settings non espone azioni contestuali, il FAB viene rimosso.

## Breakpoint

Le sole soglie architetturali sono:

- mobile `<768px`;
- tablet `768–1199px`;
- desktop/Windows `>=1200px`.

Il vecchio CSS di shell conteneva un passaggio strutturale a `1024px`. `src/randapp/randui/foundation.css`, caricato per ultimo, neutralizza quel passaggio tra `1024–1199px`, mantenendo la shell tablet. Da `1200px` la sidebar diventa primaria.

Micro-breakpoint più piccoli possono adattare un componente, ma non cambiare shell o modello di navigazione.

## Safe area e system navigation

La geometria responsive canonica è `src/randapp/adaptive-layout.css`.

Gli inset effettivi sono il massimo tra:

- CSS `env(safe-area-inset-*)` forniti da browser/PWA;
- `--rs-native-safe-*`, aggiornabili da un futuro host nativo.

`src/randapp/system-insets.js` gestisce il bridge. La safe-area superiore ha un solo proprietario: l'header sticky. Il contenuto non applica una seconda volta l'inset superiore.

Non viene imposto un cap artificiale all'inset inferiore: Home Indicator iOS e navigazione Android devono poter riservare lo spazio reale.

## Densità

`Piccolo / Normale / Grande` resta il solo contratto persistente (`apicehotel.ui-size.v1`). La densità influenza testo, touch target, spaziatura e geometria; non cambia permessi o destinazioni.

## Settings

Settings non possiede più una seconda chrome autenticata. Quando aperto da RandApp viene reso come `SettingsTemplate` all'interno di `Shell.jsx`; sidebar/header/bottom-nav restano quelli globali.

Una modalità standalone resta soltanto per il gate amministratore pre-login, dove non esiste ancora una sessione operativa.

## Proprietari CSS

- `shell.css` → aspetto visuale della chrome e delle primitive storiche;
- `adaptive-layout.css` → unica geometria responsive;
- `ui-coherence.css` → interazione, accessibilità e target;
- `randui/foundation.css` → layer finale che lega i contratti e ospita i pattern di template.

## Dipendenze

Il Core non aggiunge un secondo framework UI. I pattern utili scoperti tramite RandRadar vengono adottati come principi di registry/schema/state matrix sopra le primitive esistenti.

## Gate

Il contratto è coperto da:

- `test/randui-adaptive-layout.test.js`;
- `test/randai-block25-randui-93-97.test.js`;
- `test/randui-core-v1.test.js`;
- Playwright Chromium/WebKit e device acceptance nella CI generale.

Approfondimento: `docs/architecture/RANDUI_V1_CORE.md`.
