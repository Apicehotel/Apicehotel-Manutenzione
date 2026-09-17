# RandUI / RandApp — Fase 1: audit delle destinazioni

**Stato:** audit statico completato e verifica live parziale del pre-accesso desktop; viste autenticate e responsive non certificate.  
**Data:** 12 settembre 2026  
**Codice esaminato:** `main` al commit [b29ce65](https://github.com/Apicehotel/Apicehotel-Manutenzione/commit/b29ce65af434fedd6c6426f5f6304dba5db4bda2).  
**Fase 0:** documentata in [PR #244](https://github.com/Apicehotel/Apicehotel-Manutenzione/pull/244).

## Sintesi dell'audit

Le 24 voci di `page-catalog.js` sono **destinazioni interne** RandApp/RandAI, non 24 URL indipendenti e non l'intera superficie del prodotto. In `Shell.jsx` 22 viste operative entrano nel `RandUiPageBoundary`; Settings usa direttamente `SettingsTemplate`; la console RandAI è una route protetta autonoma `/randai`.

La radice `/` contiene inoltre Login, selezione struttura, recupero PIN e gate amministrativo pre-login. `src/main.jsx` instrada anche `/tecnico/:token`, `/tecnici-esterni`, `/s/:id` e `/n/:alias`. Questi flussi non sono voci nel catalogo delle 24 destinazioni. La Fase 1 completa deve decidere e documentare il perimetro visuale di questi ingressi e portali; non vanno conteggiati come pagine già uniformate solo perché esistono.

## Mappa delle 24 destinazioni catalogate

Le capacità sotto sono quelle dichiarate dal catalogo, non una certificazione del comportamento del flusso. Le autorizzazioni effettive restano in `VIEW_GUARDS`, navigazione per ruolo e server RLS/RPC.

| Destinazione | Template | Dominio | Capacità dichiarate |
|---|---|---|---|
| `home` | dashboard | operations | KPI, prossime azioni, suggerimento RandAI |
| `operations` | operational | operations | hub e destinazioni dipendenti dai permessi |
| `issues` | list-detail | maintenance | filtri, creazione, dettaglio, foto |
| `chat` | master-detail | communications | gruppi, messaggi, media |
| `housekeeping` | operational | housekeeping | contesto piano, camere, azione di segnalazione |
| `supplies` | operational | supplies | area/piano, richieste, consegna |
| `interventions` | list-detail | maintenance | filtri, dettaglio, risoluzione |
| `inventory` | management | warehouse | catalogo, giacenze, movimenti, audit |
| `my-work` | operational | operations | assegnazioni, stato, risoluzione |
| `planning-work` | planning | planning | timeline, creazione, dettaglio |
| `planning-sale` | planning | planning | timeline, creazione, dettaglio |
| `urgent` | list | communications | avvisi, conferma, creazione |
| `reminders` | list | planning | pianificazione, stato |
| `temperature` | monitor | sensors | stato, storico |
| `plants` | monitor | sensors | stato, storico |
| `technicians` | management | maintenance | rubrica, creazione, disponibilità |
| `profile` | form | account | preferenze, identità |
| `pin` | form | account | aggiornamento credenziale |
| `manual` | search-archive | guides | ricerca, contenuti |
| `feedback` | form | account | invio |
| `feedback-received` | list | administration | revisione feedback |
| `desktop-download` | system-state | desktop | download, rilevamento desktop |
| `settings` | settings | administration | utenti, ruoli, sensori, consumi, diagnostica |
| `randai` | monitor | intelligence | assistente, salute, controlli, guide |

## Navigazione e permessi: fonti effettive

- `Shell.jsx` mantiene la vista interna in stato React (`view`); non è un router a 24 URL.
- `nav.js` definisce gruppi, etichette e `VIEW_GUARDS`; la visibilità dipende anche da `canUser`.
- `role-navigation.js` configura la collocazione per ruolo e mappa viste su chiavi di navigazione; il placement non sostituisce l'autorizzazione.
- `App.jsx` gestisce separatamente sessione, login, selezione struttura, recupero PIN e gate admin.
- `main.jsx` possiede il routing per i portali pubblici/esterni e la console RandAI.

Non deduco che una funzione sia pubblica o priva di protezione dalla sola presenza di un link. Il controllo completo richiede prove UI con ruoli di test e verifica delle guard/RLS.

## Template e copertura

Il catalogo usa 12 dei 14 template disponibili. `auth` e `wizard` non hanno una destinazione nel catalogo attuale: non sono marcati come zombie. La presenza di `auth` insieme ai flussi di login fuori catalogo è un gap da valutare; prima si decide un unico contratto per le schermate pre-autenticazione, poi si cambia il catalogo o il test.

Le due viste Planning e le due viste Temperature/Plants riusano rispettivamente componenti/famiglie comuni: questo è riuso esplicito, non prova di duplicazione errata.

## Finding prioritari

| ID | Evidenza | Impatto | Azione raccomandata |
|---|---|---|---|
| F1-01 | Catalogo 24 limitato alle destinazioni interne; esistono flussi login/recovery e route autonome fuori catalogo | Un audit dichiarato “tutto RandApp” può omettere superfici frequenti o pubbliche | Formalizzare un inventario unico di route + stati di ingresso, oppure cataloghi distinti con ownership esplicita |
| F1-02 | RandUI avvolge le pagine, ma la migrazione dichiara esplicitamente che il CSS di dominio può restare | Wrapper comune non garantisce gerarchia e densità uniformi nei contenuti interni | Confrontare i render; classificare ogni eccezione come voluta o da convergere |
| F1-03 | Gli E2E CI coprono login e gate Settings pre-login; gli screenshot non rappresentano le 24 viste autenticate | Il gate verde non certifica l'aspetto e l'uso dei flussi operativi | Pilotare una matrice di screenshot/interaction sulle pagine una volta disponibile test account e browser |
| F1-04 | `main.jsx` importa un gruppo ampio di CSS di feature; Shell aggiunge fogli mobile/header; PageBoundary importa `layout-v2.css`, Foundation importa adaptive, coherence, visual-language e completion | Il confine tra stile globale, chrome, responsive geometry e pagina è difficile da seguire | Disegnare un grafo degli owner/import e consolidare solo dopo diff screenshot e analisi dei consumer |
| F1-05 | La preview live mostra il pre-accesso desktop, ma non le viste autenticate; il login misura 950 px di altezza documento su viewport 936 px (14 px di overflow verticale, senza overflow orizzontale) | È provata solo la superficie iniziale, non il layout operativo o responsive | Correggere/accettare il piccolo overflow dopo confronto su viewport e poi acquisire baseline autenticate |

## Zombies: esito prudente

Nessuna pagina o stylesheet è stato rimosso in questa fase. I file CSS laterali hanno import attivi in `main.jsx` o `Shell.jsx`; quindi non sono zombie solo perché esistono più livelli. Planning/Planning Sale e Temperature/Plants condividono intenzionalmente componenti. Per dichiarare un elemento zombie servono ricerca dei consumer, route/import reachability, riferimenti nei test e verifica che non sia un ingresso supportato.

## Copertura E2E e prova visuale

`test/e2e.mjs` esegue viewport 320/375/390/430/768/1024/1440, Chromium, Pixel 7 Chromium e iPhone 13 WebKit, temi e densità; la schermata verificata resta il login con un passaggio sul gate Settings pre-login. `test/device-acceptance.mjs` controlla installabilità/manifest, PIN, rotazione, tastiera e transizione offline sul flusso iniziale.

La CI della PR di Fase 0 ha passato browser/device gates e ha caricato gli screenshot nel [run #34688958586](https://github.com/Apicehotel/Apicehotel-Manutenzione/actions/runs/34688958586). I test sono evidenza di comportamento automatizzato; la review visuale live descritta sotto copre soltanto il pre-accesso desktop.

## Verifica live della preview

La preview [Ocean](https://randapp-b2akx.ondigitalocean.app/) è stata aperta il 12 settembre 2026 e controllata in Chrome a **1363 × 936 px**.

- Il login ha gerarchia leggibile: identità RandApp, campi Utente/PIN, azione primaria e accesso alle impostazioni sono distinti e centrati. Non ho rilevato overflow orizzontale.
- Il documento misura **950 px** su 936 px di viewport: resta uno scorrimento verticale di **14 px**. È un difetto minore del pre-accesso desktop, da verificare dopo eventuale correzione su altri viewport.
- Un invio con campi vuoti mostra l'alert accessibile **“Seleziona un utente valido dalla lista”**; non sono state inserite credenziali. Il testo del campo invita a scrivere il nome, perciò sarebbe utile verificare se il controllo utenti è un selettore/autocomplete e rendere l'istruzione più esplicita.
- Il pulsante Impostazioni apre il gate **“Accesso protetto amministratore”** e richiede un PIN amministratore. Senza credenziale/sessione autorizzata l'audit si ferma qui.

Questa prova non certifica le pagine operative, i ruoli, gli stati di rete o i layout tablet/mobile. Non ho modificato l'app runtime; il rilievo del login va trattato come finding da validare, non come modifica già applicata.

## Cosa resta per chiudere la Fase 1

1. Ottenere una sessione di test autorizzata (un ruolo operativo e uno amministrativo) già configurata sulla preview; non inviare PIN o credenziali in chat.
2. Acquisire e ispezionare desktop, tablet e telefono per le viste catalogate accessibili ai ruoli e per gli ingressi/portali fuori catalogo.
3. Verificare azione primaria, stati loading/vuoto/errore/offline e ritorno indietro per ogni famiglia di template.
4. Confrontare il piccolo overflow desktop e la chiarezza del selettore utenti prima di decidere il pilota visuale e classificare eventuali zombie.

## Fonti nel repository

- [Catalogo](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/randui/page-catalog.js)
- [Shell e destinazioni](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/Shell.jsx)
- [Navigazione e guard](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/nav.js)
- [Navigazione per ruolo](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/role-navigation.js)
- [Routing top-level e portali](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/main.jsx)
- [Template](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/randui/template-registry.js)
- [E2E](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/test/e2e.mjs)
- [Device acceptance](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/test/device-acceptance.mjs)
