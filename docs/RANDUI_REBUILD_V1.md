# RandUI Rebuild v1

## Stato operativo — 18 settembre 2026

RandUI è la UI canonica di RandApp. La ricostruzione non modifica contratti dati, Supabase/RLS, permessi o logica business: cambia esclusivamente shell, layout, navigazione, componenti visuali e comportamento responsive.

La shell mobile/tablet è stata consolidata dopo test reali su iPhone. La soluzione stabile non usa più un header `sticky` o `fixed` sopra una pagina che scorre: **la shell occupa il viewport e solo il contenuto centrale scorre**.

Contratto attuale:

`Head bar ferma → contenuto centrale scrollabile → bottom nav`

Questa è una regola architetturale RandUI e non una patch locale della Home.

## Obiettivo

Ricostruire e mantenere RandApp con una UI unica, coerente e adattiva, lasciando intatti dati, logica business, Supabase/RLS, permessi, offline, RandAI, Planning, Housekeeping e gli altri moduli applicativi.

## Principio

RandUI ha un solo proprietario per ogni responsabilità. Se una soluzione strutturale risolve un problema comune, sostituisce la soluzione precedente invece di aggiungere un altro layer concorrente.

Il backup storico della fase di rebuild resta `backup/randui-pre-rebuild-20260916`. Le modifiche correnti continuano a passare da branch dedicato + PR + revisione umana.

## Boundary

RandUI può cambiare:

- shell;
- layout;
- spacing;
- navigazione;
- componenti visuali;
- CSS;
- comportamento responsive;
- gerarchia e densità delle informazioni.

RandUI non può cambiare senza PR separata:

- contratti dati;
- RPC;
- RLS;
- tabelle;
- autorizzazioni;
- semantics dei moduli;
- business rules.

## Architettura UI canonica

- `Shell.jsx`: cornice autenticata e navigazione globale.
- Head bar: struttura, presenza, notifiche e profilo/menu.
- Desktop sidebar: navigazione primaria da desktop.
- Mobile drawer: navigazione estesa.
- Bottom nav mobile/tablet: cinque slot principali.
- `.rs-content`: unico viewport scrollabile su mobile/tablet.
- `RandUiPageBoundary`: boundary comune delle pagine migrate.
- Page Catalog + Template Registry + Component Registry: composizione RandUI.
- `adaptive-layout.css`: geometria responsive e safe-area.
- `randui/foundation.css`: layer finale di composizione e guard condivisi.

Le pagine di dominio non devono creare una seconda shell, una seconda navbar o propri offset globali.

## Navigazione primaria corrente

La bottom nav operativa usa cinque destinazioni stabili:

1. Operatività
2. Planning
3. Home
4. Task
5. RandAI

Le viste secondarie restano raggiungibili dalla shell/drawer secondo ruolo, permessi e configurazione.

RandAI è una **pagina di primo livello dentro RandApp**, non un popup. La route protetta `/randai` resta separata come console/control center amministrativa.

## Contratto mobile/tablet: scroll ownership

Questa è la regola che ha risolto il problema della head bar su iPhone/Safari e browser in-app.

Su viewport <1200px:

- `html`, `body` e `#root` non possiedono lo scroll verticale dell'app;
- `.rs-root` occupa `100dvh` e non scorre;
- `.rs-app` occupa `100dvh` e organizza la chrome;
- la head bar resta nella prima riga della shell e non scorre;
- `.rs-content` è l'unico proprietario dello scroll verticale;
- la bottom nav resta indipendente dal contenuto;
- nessuna pagina aggiunge spacer, offset o compensazioni per l'header.

In pratica non si tenta più di “tenere fermo” l'header mentre l'intera pagina scorre: **l'header è fuori dal contenitore che scorre**.

Questo evita le differenze di comportamento di `position: sticky` e `position: fixed` su Safari/iOS, safe-area, browser embedded e modalità UI Grande.

## Safe-area

La safe-area resta centralizzata.

- `system-insets.js` espone gli inset nativi futuri.
- `adaptive-layout.css` risolve il massimo tra `env(safe-area-inset-*)` e gli inset nativi.
- la head bar gestisce la safe-area superiore;
- bottom nav e contenuto rispettano safe-area inferiore/laterale;
- le singole pagine non devono duplicare la safe-area globale.

## Regole layout

- mobile-first;
- `100dvh` centralizzato nella shell;
- un solo scroll owner su mobile/tablet: `.rs-content`;
- nessun offset verticale hardcoded nelle singole pagine;
- nessun secondo header applicativo;
- spacing tramite token;
- touch target minimo coerente con RandUI;
- Piccolo / Normale / Grande governati da token di densità;
- nessun overflow orizzontale globale;
- una sola sorgente per head bar, sidebar, drawer e bottom nav;
- desktop >=1200px con sidebar primaria;
- tablet 768–1199px mantiene la shell touch;
- mobile <768px a colonna singola.

## Home

La Home è una dashboard operativa, non un elenco generico di shortcut.

Contiene:

- riepilogo operativo;
- quadro struttura;
- segnalazioni;
- interventi;
- avvisi;
- promemoria;
- planning;
- priorità;
- meteo;
- RandAI subordinato alle priorità operative.

Le azioni globali flottanti non devono duplicare funzioni che hanno già una pagina o un ingresso esplicito.

## Operatività

Operatività raggruppa:

- Segnalazioni;
- Interventi;
- Top 3 elementi recenti/rilevanti;
- deep-link al record esatto.

## Task

Task raggruppa:

- Promemoria;
- Avvisi;
- Top 3 elementi;
- deep-link all'elemento esatto.

## Rifornimenti

Rifornimenti è una pagina dedicata.

Il vecchio launcher flottante globale `rs-supply-launcher` è stato rimosso. Rifornimenti non deve ricomparire come pulsante flottante globale sopra la bottom nav.

## RandAI

RandAI nella shell è page-native:

- nessun wrapper popup;
- nessun pulsante X da modal;
- nessun redirect alla console amministrativa;
- contesto hotel attivo;
- dati live, memoria, procedure, storico e manuali;
- procedure strutturate renderizzate in modo sicuro anche quando gli step arrivano come oggetti.

## Strategia di migrazione

1. mantenere una sola shell canonica;
2. migrare le viste senza cambiare la logica business;
3. verificare prima il comportamento globale, poi il CSS locale;
4. testare iPhone/Android/tablet/desktop + Piccolo/Normale/Grande;
5. eliminare CSS e componenti legacy solo quando non sono più referenziati;
6. preferire una correzione strutturale condivisa a patch ripetute per pagina;
7. validare ogni modifica su Ocean prima del merge umano.

## Anti-regressione

I test RandUI devono proteggere almeno:

- shell mobile/tablet;
- scroll ownership;
- head bar non scrollabile;
- bottom nav;
- safe-area;
- overflow;
- PageBoundary;
- layout mobile/tablet/desktop;
- modalità Grande;
- assenza di launcher globali rimossi;
- RandAI page-native;
- Chromium e WebKit.

La CI generale resta il gate prima del merge.

## Freeze

Nessun agente può fare push, merge o deploy diretto su `main`.

Ogni modifica RandUI passa da:

`branch dedicato → test → CI → Ocean preview → revisione umana → merge`

## Regola permanente

**Non fissarsi sulla prima struttura che funziona.** Se il comportamento reale sui dispositivi dimostra che l'architettura è sbagliata, RandUI deve cambiare il modello, non accumulare correzioni locali.

La soluzione corrente della head bar ne è l'esempio: dopo aver provato `sticky`, `fixed`, offset e misurazione dinamica, la soluzione stabile è stata spostare lo scroll nel contenuto centrale e lasciare la chrome fuori dallo scroll.
