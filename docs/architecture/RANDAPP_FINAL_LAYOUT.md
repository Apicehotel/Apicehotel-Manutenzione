# RandApp Final Layout

Questo documento descrive il pass finale del layout applicativo introdotto nella PR #112. Non cambia il dominio operativo: consolida la resa di Home, shell, navigazione, pannelli, form, sheet, drawer e workspace desktop in un unico sistema responsive.

## Contratto mobile

- Bottom navigation reale a cinque slot: Segnalazioni, Interventi, Home, Planning, Magazzino.
- Home resta lo slot centrale, ma non viene più sollevata come un terzo livello visivo.
- Nuovo e RandAI sono due azioni dirette incorporate nella corona superiore della stessa superficie Liquid Glass della navbar.
- Nessuna linea/grip decorativa nel dock chiuso.
- Swipe verticale sulla superficie mantiene l'apertura delle azioni rapide; il pannello espanso cresce sopra la stessa shell.
- Il `+` continua a richiamare l'InsertLauncher reale; RandAI continua a emettere `randai-toggle`.
- Il menu laterale resta gesture-first tramite swipe destra→sinistra e mantiene il drawer esistente.
- Safe-area browser e inset nativi condividono `--rs-safe-*` senza cap artificiale.

## Gerarchia visiva

Liquid Glass è riservato al chrome: header, dock/navbar, sheet e superfici flottanti. Contenuti operativi, KPI, liste, segnalazioni, RandAI priority card, planning e magazzino restano superfici solide ad alto contrasto.

La Home è il riferimento di densità per il resto dell'app: hero compatto, KPI leggibili, card priorità con gerarchia chiara, stesso raggio e ritmo verticale dei moduli operativi.

## Responsive

- Telefoni: contenuto a tutta larghezza con padding safe-area e dock flottante.
- Tablet 640–959px: stessa grammatica mobile, maggiore spazio laterale e KPI su quattro colonne quando possibile.
- Windows/desktop >=960px: sidebar persistente, workspace ampio, header operativo e contenuti fino a 1320px senza effetto telefono stirato.
- Display >=1500px: sidebar e padding crescono senza allungare eccessivamente le righe.
- Grande mode aumenta controlli e spazi mantenendo la stessa geometria e lo stesso ordine di navigazione.

## File

- `src/randapp/prototype-liquid-dock.js`: ownership strutturale della navbar, gesture Pointer Events e collegamento alle azioni reali.
- `src/randapp/prototype-liquid-dock.css`: geometria finale del dock mobile.
- `src/randapp/randapp-final-layout.css`: pass di consolidamento globale caricato per ultimo.
- `src/randapp/vendor/liquid-glass-ui.css`: materiale Liquid Glass vendorizzato con fallback.
- `test/liquid-dock-integration.test.js`: contratti di import order, responsive layout, accessibilità e single-surface dock.

## Vincolo di merge

La PR resta un ambiente di prova e non deve essere mergiata in `main` prima dell'approvazione visiva esplicita del layout in preview.