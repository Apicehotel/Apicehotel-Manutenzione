# RandApp UI Visual System — Punto 2

## Decisione

RandApp mantiene i propri componenti React operativi e adotta un **visual layer proprietario** ispirato ai pattern migliori osservati in Material 3, Konsta UI, 21st.dev, Glass UI e LiquidGlass-UI.

Non viene aggiunta una libreria UI runtime nel Punto 2. La ragione è operativa: i componenti `rs-*` sono già usati in Segnalazioni, Planning, Housekeeping, Magazzino, Admin e RandAI; sostituirli in blocco aumenterebbe regressioni, bundle e divergenza tra iOS/Android/Windows senza un vantaggio equivalente.

## KEEP / UPGRADE / NO ADD

### KEEP
- componenti semantici `Button`, `IconButton`, `Card`, `Field`, `Sheet`, `Modal`, `Segmented`, `Badge`;
- App Shell e contratto safe-area del Punto 1;
- tema `system/light/dark`;
- modalità Piccolo/Normale/Grande;
- sidebar Windows e bottom navigation mobile.

### UPGRADE
- token Material-like per surface, accent, stato, touch target, spacing e radius;
- light theme realmente chiaro e neutro;
- gerarchia tramite tipografia/spaziatura invece di gradienti decorativi;
- focus-visible e touch target minimo 44px;
- chrome condiviso con glass controllato;
- reduced motion, reduced transparency e forced colors;
- FAB `+` come azione separata, con colore semantico e animazione ridotta.

### NO ADD ora
- Konsta come framework globale;
- shadcn/21st.dev copiati indiscriminatamente;
- refraction canvas/SVG di Liqui Design su tutte le superfici;
- glass su card operative e tabelle;
- animazioni decorative permanenti.

Questi elementi restano fonti di pattern o candidati per componenti specifici, non una seconda design system concorrente.

## Glass contract

Il glass è consentito solo su chrome/transient surfaces: header, bottom navigation, sheet, drawer e hotel chip. Il contenuto operativo resta su superfici solide per leggibilità e prevedibilità.

Il browser usa `backdrop-filter` solo quando supportato. In caso contrario la stessa UI usa una superficie solida/semitrasparente. `prefers-reduced-transparency`, `prefers-reduced-motion` e `forced-colors` hanno fallback espliciti.

Questo evita di dipendere dalla refrazione completa, che non è uniforme tra Safari/WebKit, Chromium e Firefox.

## Component contract

- touch target condiviso: almeno 44px;
- `focus-visible` esplicito;
- primary action = `--rs-accent`;
- success/warning/error sono semantici, non colori decorativi;
- card operative solide;
- glass solo dove non trasporta informazioni critiche;
- Grande mode continua a scalare tramite token;
- nessuna pagina deve introdurre una propria palette globale.

## Rollout

Il file `src/randapp/randapp-visual-system.css` è importato dal layer finale `app-shell-foundation.css`, quindi aggiorna i componenti condivisi senza riscrivere la logica dei domini. Le eccezioni legacy possono essere migrate progressivamente verso i token `--rs-*`.

## Test

`test/ui-visual-system.test.js` verifica import, token semantici, fallback glass, accessibilità e il vincolo che le card operative non usino backdrop-filter.
