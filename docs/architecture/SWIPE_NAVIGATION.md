# Swipe Navigation

## Obiettivo

Liberare uno slot della bottom navigation senza duplicare o riscrivere il drawer Menu.

## Contratto

La bottom navigation mobile mantiene cinque slot visibili:

1. Segnalazioni
2. Interventi
3. Home
4. Planning
5. Magazzino

`Menu` non occupa più uno slot visibile. Rimane montato come target accessibile al runtime e viene aperto con swipe orizzontale da destra verso sinistra.

## Protezioni gesto

- distanza orizzontale minima: 72 px;
- deriva verticale massima: 48 px;
- prevalenza orizzontale minima 1.45x rispetto allo spostamento verticale;
- esclusione dei primi 18 px del bordo sinistro per non interferire con il back gesture nativo;
- nessun trigger iniziando su input, textarea, select, button, link, slider o elementi con `data-swipe-lock`;
- nessuna apertura se è già presente overlay/dialog.

Il tap e gli accessi desktop/sidebar restano disponibili: lo swipe è una scorciatoia, non una dipendenza esclusiva.

## Implementazione

- `src/randapp/swipe-navigation.js`: classificazione e tracking del gesto;
- `src/randapp/shell-navigation.js`: slot 5 Magazzino e target Menu gesture-only;
- `src/randapp/app-shell-foundation.css`: cinque colonne visibili e target Menu nascosto fuori dalla geometria;
- `test/swipe-navigation.test.js`: soglie e falsi positivi;
- `test/ui-shell-foundation.test.js`: contratto navbar aggiornato.
