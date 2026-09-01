# UI Components & Theme System — Punto 2

## Obiettivo

Il Punto 2 evolve il design system esistente senza introdurre un secondo framework UI. RandApp mantiene i componenti `rs-*` e aggiunge un layer visivo light-first, Material-inspired e con Liquid Glass selettivo.

## Decisioni

### KEEP

- `src/randapp/ui.jsx` come raccolta di primitive React condivise (`Button`, `IconButton`, `Card`, `Field`, `TextInput`, `Badge`, `Segmented`, `Sheet`, `Modal`, stati vuoti e spinner).
- `shell.css` come base strutturale/tokens legacy compatibili.
- `app-shell-foundation.css` come autorità finale sulla geometria di shell e navigazione.
- tema `Sistema / Chiaro / Scuro` e modalità `Piccolo / Normale / Grande`.

### UPGRADE

- il tema predefinito, in assenza di preferenza salvata, diventa **Chiaro**;
- i tre hotel ricevono un accento visivo separato dai colori semantici;
- header, bottom navigation, Sheet e FAB usano un materiale glass sobrio con fallback opaco;
- card, input, pulsanti e segmenti assumono gerarchia Material-like chiara, senza trasformare RandApp in una dashboard generica;
- reduced motion, increased contrast e forced colors disattivano o semplificano gli effetti decorativi.

### NO ADD

Non vengono installati Konsta, HeroUI, 21st registry o LiquidGlass-UI come dipendenze runtime. I pattern verificati sono utili, ma RandApp possiede già primitive, safe-area, test cross-browser e shell sufficienti. Aggiungere un framework parallelo aumenterebbe cascade, bundle e rischio di incoerenza.

## Theme contract

`theme.js` imposta:

- `html[data-theme="light|dark"]` per il tema risolto;
- `html[data-theme-choice="system|light|dark"]` per la scelta utente;
- `html[data-hotel="hotelgio|chocohotel|brigantino"]` per l'accento della struttura attiva.

La sessione resta la sorgente di verità per l'hotel. L'evento `apice-session-changed` aggiorna l'accento senza richiedere un reload.

Gli accenti hotel non devono mai sostituire:

- `--rs-danger` per errori/urgenze;
- `--rs-warn` per warning/attese;
- `--rs-ok` per completato/successo.

## Liquid Glass contract

Glass ammesso su:

- header;
- bottom navigation;
- Sheet;
- FAB contestuale.

Glass escluso come default da:

- card operative;
- liste;
- form;
- tabelle;
- stati semantici.

Il fallback senza `backdrop-filter` deve restare leggibile e opaco. `prefers-reduced-motion`, `prefers-contrast` e `forced-colors` hanno precedenza sull'estetica.

## Piattaforme

- iOS/PWA: Safari/WebKit usa blur/fallback senza dipendere da rifrazione SVG/Chromium-only;
- Android/PWA: stessa UI e stessi token; il Punto 1 continua a proteggere gesture/3-button navigation;
- Windows: superfici di contenuto solide e sidebar; glass resta limitato alla chrome flottante.

## File

- `src/randapp/ui-material-glass.css`: layer visuale Punto 2;
- `src/randapp/theme.js`: tema risolto + hotel accent runtime;
- `src/randapp/theme-coherence.css`: importa il layer e mantiene regole trasversali;
- `test/ui-components-theme-system.test.js`: contratto permanente del Punto 2.
