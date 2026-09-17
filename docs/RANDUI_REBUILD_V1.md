# RandUI Rebuild v1

## Obiettivo
Ricostruire da zero la UI di RandApp mantenendo intatti dati, logica business, Supabase/RLS, permessi, offline, RandAI, Planning, Housekeeping e moduli applicativi esistenti.

## Principio
La vecchia UI non viene cancellata durante la ricostruzione. Il backup canonico è il branch `backup/randui-pre-rebuild-20260916`. La nuova UI nasce in parallelo su `feat/randui-rebuild-v1`.

## Boundary
La nuova UI può cambiare shell, layout, spacing, navigazione, componenti visuali e CSS. Non può cambiare contratti dati, RPC, RLS, tabelle, autorizzazioni, semantics dei moduli o business rules senza PR separata.

## Architettura UI
- `AppShell`: cornice pura dell'app.
- `AppHeader`: header unico.
- `DesktopSidebar`: navigazione desktop.
- `MobileDrawer`: navigazione mobile estesa.
- `MobileBottomNav`: navigazione primaria mobile.
- `PageViewport`: unico contenitore delle pagine.
- moduli funzionali montati dentro `PageViewport`, senza navbar o offset propri.

## Regole layout
- mobile-first;
- safe-area iOS centralizzata;
- `100dvh` centralizzato;
- nessun offset verticale hardcoded nelle singole pagine;
- spacing tramite token;
- touch target minimo 44x44;
- Piccolo / Normale / Grande gestiti tramite token di densità;
- nessun overflow orizzontale;
- una sola sorgente per header, sidebar, drawer e bottom nav.

## Strategia di migrazione
1. creare shell e token nuovi in parallelo;
2. montare una pagina pilota;
3. validare iPhone/Android/desktop + Piccolo/Normale/Grande;
4. migrare progressivamente le viste senza cambiare logica;
5. rimuovere CSS legacy solo quando nessuna vista lo usa più;
6. chiudere con test visuali e regressione layout.

## Freeze
Nessun push/deploy diretto su `main`. Ogni step passa da branch + PR + review umana.
