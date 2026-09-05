# RandUI v1 Core

RandUI v1 è il solo contratto grafico e strutturale di RandApp. Il Core non ridisegna ogni modulo: definisce le regole che ogni modulo usa oggi o deve adottare durante la migrazione.

## Pipeline canonica

`Page Schema → Template Resolver → Template Registry → Component Registry → Foundation → Shell → Quality Guard`

Permessi e RLS/RPC restano autorità funzionale. RandUI decide rappresentazione, priorità, layout e stato visuale; non concede accesso.

## Proprietari

| Responsabilità | Proprietario |
| --- | --- |
| Primitive React | `src/randapp/ui.jsx` |
| Aspetto chrome/componenti | `src/randapp/shell.css` |
| Geometria responsive | `src/randapp/adaptive-layout.css` |
| Interazione/accessibilità | `src/randapp/ui-coherence.css` |
| Foundation finale | `src/randapp/randui/foundation.css` |
| Design contract | `src/randapp/randui/design-contract.js` |
| Component registry | `src/randapp/randui/component-registry.js` |
| Template registry | `src/randapp/randui/template-registry.js` |
| Template React | `src/randapp/randui/templates.jsx` |
| Page schema/resolver | `src/randapp/randui/page-schema.js` |
| Catalogo pagine | `src/randapp/randui/page-catalog.js` |
| System states | `src/randapp/randui/system-states.jsx` |

`foundation.css` viene caricato per ultimo dal runtime e importa `adaptive-layout.css` e `ui-coherence.css`. I fogli CSS di dominio possono specializzare un modulo, ma non ridefinire shell, breakpoint, safe-area o interazione globale.

## Breakpoint canonici

- mobile: `0–767px`;
- tablet: `768–1199px`;
- desktop/Windows: `>=1200px`.

Il vecchio passaggio shell a `1024px` è neutralizzato dalla foundation tra `1024–1199px`: in quella fascia RandApp resta tablet con header e bottom navigation. I micro-breakpoint locali sono ammessi soltanto per adattare un componente, mai per cambiare architettura.

## Densità

Il solo contratto persistente resta:

- `small` → Piccolo;
- `normal` → Normale;
- `large` → Grande.

La chiave rimane `apicehotel.ui-size.v1`. Nessun secondo zoom o sistema di densità è ammesso.

## Template ufficiali

1. `dashboard`
2. `list`
3. `list-detail`
4. `master-detail`
5. `operational`
6. `planning`
7. `form`
8. `wizard`
9. `settings`
10. `management`
11. `monitor`
12. `system-state`
13. `auth`
14. `search-archive`

Ogni template dichiara slot, responsive strategy, densità predefinita e componenti ammessi. Una pagina nuova parte da un `pageType`, non da CSS libero.

## Component registry e state matrix

Le primitive storiche valide di `ui.jsx` non vengono duplicate. Il registry aggiunge metadata e una state matrix dichiarativa (`default`, `focus`, `active`, `disabled`, `loading`, `error`, `read-only`, ecc.).

Una dipendenza esterna non è stata aggiunta: i pattern migliori rilevati da RandRadar vengono assorbiti nel contratto senza introdurre un secondo design system runtime.

## System states

`SystemState` standardizza:

`loading / empty / no-results / error / degraded / offline / queued / syncing / stale / conflict / forbidden / unavailable / success / warning / in-progress`

I moduli verranno migrati progressivamente a questi stati nel Blocco 3.

## Shell unica

`Shell.jsx` resta il solo chrome autenticato. Impostazioni non crea più un secondo header o una seconda bottom navigation: viene resa come `SettingsTemplate` dentro la Shell. La modalità standalone di Settings esiste soltanto per il gate amministratore pre-login, dove non esiste ancora una sessione operativa.

## Catalogo di migrazione

`page-catalog.js` assegna già un template a Home, Segnalazioni, RandChat, Housekeeping, Rifornimenti, Interventi, Magazzino, Planning, Urgenze, Sensori, Tecnici, Profilo, Guide, Feedback, Settings e RandAI. Questo catalogo è il ponte verso il Blocco 3.

## Zombie policy

- `app-shell-foundation.css` resta eliminato: duplicava la geometria adattiva;
- il secondo chrome Settings è eliminato;
- i CSS di dominio non vengono cancellati in massa nel Core: saranno rimossi soltanto quando la relativa pagina viene migrata e i test dimostrano che non esistono più consumatori;
- una classe CSS orfana non giustifica da sola una riscrittura rischiosa di `shell.css`: la pulizia segue la migrazione del dominio.

## Deploy durante l'unificazione

Durante RandUI v1:

- Vercel Git deploy resta disabilitato;
- sviluppo e prove operative vengono pubblicati soltanto su DigitalOcean/Ocean;
- la promozione su Vercel richiede una decisione esplicita dopo chiusura della migrazione e dei gate.

## Gate

`npm run test:randui` esegue sia i contratti RandUI live esistenti sia `test/randui-core-v1.test.js`.

La CI completa continua a richiedere build, audit, Quality Matrix, Critical Gate, Chromium/WebKit, device acceptance, RandCore e LTS.
