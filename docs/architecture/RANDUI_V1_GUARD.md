# RandUI v1 — Guard (Blocco 2)

RandUI Guard è il gate che impedisce alle pagine migrate o nuove di uscire dal contratto definito nel Blocco 1.

## Obiettivo

Il Core definisce *come* si costruisce una pagina. Il Guard verifica automaticamente che quella pagina continui a rispettarlo su smartphone, tablet e desktop.

Catena ufficiale:

`Design Contract -> Component Registry -> Template Registry -> Page Schema -> RandUI Guard -> Browser/Device Gate`

## Cosa blocca

Il guard è fail-closed per:

- componenti non registrati o non ammessi dal template;
- slot non dichiarati nel template;
- overflow orizzontale del documento;
- elementi strutturali che escono dal viewport;
- controlli RandUI interattivi sotto 44x44 px;
- controlli RandUI senza nome accessibile;
- template renderizzati ma non registrati;
- più di un `h1` primario nello stesso template;
- ID DOM duplicati;
- reintroduzione di geometrie fragili nella foundation, come `width: 100vw`.

Le eccezioni devono essere intenzionali e dichiarate (`data-randui-scroll-x="allowed"` per uno scroller orizzontale controllato, `data-randui-touch-exempt="true"` solo quando il controllo non è un target touch operativo).

## Matrice viewport obbligatoria

Il browser gate usa una sola matrice condivisa:

| Classe | Viewport |
| --- | ---: |
| telefono minimo | 320x568 |
| telefono compatto | 375x667 |
| iPhone operativo | 390x844 |
| telefono grande | 430x932 |
| tablet portrait | 768x1024 |
| tablet landscape / fascia critica | 1024x768 |
| desktop reception | 1440x1000 |

A questa matrice si aggiungono Pixel 7 Chromium e iPhone 13 WebKit, tema Light/Dark/System e densità Small/Normal/Large già coperti dal gate esistente.

## Ownership

- `src/randapp/randui/guard.js`: regole pure di composizione e geometria.
- `test/randui-guard-v1.test.js`: contratti statici/fail-closed.
- `test/e2e.mjs`: misura il DOM reale e passa lo snapshot al Guard.
- `test/device-acceptance.mjs`: conferma iPhone, Android, Windows-like, PWA, rotazione, tastiera e offline.
- `npm run test:randui`: gate RandUI completo.
- `npm run test:randui:guard`: iterazione rapida sul solo Guard.

Non viene introdotto un secondo framework di test o design system: Playwright e i contratti Node già presenti restano gli unici strumenti.

## Regola per il Blocco 3

Una pagina non è considerata migrata a RandUI se:

1. non ha un `pageType` nel catalogo;
2. usa componenti fuori dal registry/template;
3. introduce uno slot non dichiarato;
4. fallisce il Guard a una delle larghezze canoniche;
5. rompe browser/device acceptance.

Questo rende la migrazione progressiva: il codice legacy può essere sostituito una pagina alla volta, ma ogni pagina completata entra immediatamente sotto protezione automatica.
