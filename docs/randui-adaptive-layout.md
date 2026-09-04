# RandUI Adaptive Layout

## Obiettivo

RandApp usa una sola architettura UI adattiva per PC/Windows, tablet, iPhone/iPadOS e Android. Il layout non dipende dal nome del sistema operativo: usa viewport, orientamento, input touch/pointer e la preferenza persistente Piccolo/Normale/Grande.

## Ordine delle autorità

`Hotel scope → identità → permessi → interessi → capacità dispositivo → orientamento/input → densità UI → layout`

I permessi restano autorità: un interesse può solo dare priorità a una funzione già autorizzata. Non può renderla visibile o eseguibile se RLS/RPC/permission policy la negano.

## Interessi

La configurazione di navigazione per ruolo già esistente viene riusata come prima sorgente dichiarativa degli interessi operativi: le destinazioni impostate su `bottom` hanno priorità nel bottom-nav. Il contratto `adaptive-layout.js` supporta anche `user.interests` espliciti per una futura personalizzazione individuale senza cambiare la shell.

Il bottom-nav mantiene due ancore stabili: Home in posizione 3 e Altro in posizione 5. Le posizioni operative 1, 2 e 4 sono selezionate soltanto tra destinazioni autorizzate e ordinate per interessi.

## Device contract

- mobile: `<768px`, navigazione touch primaria e contenuto a colonna singola;
- tablet: `768–1199px`, bottom-nav touch e contenuto più ampio, senza simulare desktop;
- desktop: `>=1200px`, sidebar primaria e contenuto con larghezza massima controllata;
- pointer coarse: target minimi touch anche su viewport ampie;
- landscape mobile: padding laterale adattivo e safe-area completa.

## Piccolo / Normale / Grande

La persistenza canonica `apicehotel.ui-size.v1` resta unica. Non viene introdotto un secondo zoom. Le tre modalità governano scala, target, spaziature e geometria; Grande non è solo testo più grande e Piccolo non può scendere sotto target utilizzabili.

## Safe-area e overflow

Le safe-area browser e i futuri native insets condividono le variabili `--rs-safe-*`. Il contenuto usa `min-width: 0`, larghezza controllata e wrapping difensivo per evitare overflow orizzontale accidentale. Drawer e bottom-nav rispettano safe-area iOS/Android.

## Quality gate

Contratti puri: `node --test test/randui-adaptive-layout.test.js`.

La CI generale deve continuare a passare build, RandUI contracts, Playwright Chromium/WebKit e device acceptance. Le combinazioni da considerare nel QA sono PC/tablet/mobile × Piccolo/Normale/Grande, con portrait/landscape e touch/pointer dove applicabile.

## Zombie scan

Nessuna eliminazione in questo intervento. `ui-size.js`, `role-navigation.js`, sidebar, drawer e bottom-nav sono sistemi canonici e vengono riusati. `housekeeping-v2.jsx` non è zombie: `housekeeping-v3.jsx` lo importa come base e aggiunge lo storico. Nessun framework UI, device detection SDK o seconda navigation stack è stato introdotto.
