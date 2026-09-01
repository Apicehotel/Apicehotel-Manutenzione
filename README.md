# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Stato attuale

RandApp usa un unico progetto Supabase multi-hotel. I dati operativi sono separati tramite `hotel_id`, membership, RLS, vincoli relazionali e test cross-hotel. L'autenticazione PIN è server-side: il PIN non viene confrontato nel browser.

Funzioni consolidate:

- segnalazioni manutentive con foto, storico, filtri, ordinamenti e workflow operativo;
- avvisi urgenti con presa in carico, completamento e reminder;
- interventi, Planning Lavori e Planning Sale;
- Housekeeping con import `.xls`, storico giornaliero e idempotenza;
- rifornimenti interni Housekeeping → Manutenzione per Minibar e Consumo, con catalogo Admin, esiti `Consegnato`/`Manca` e aggiornamenti Realtime;
- promemoria, inbox notifiche, push e ntfy per struttura;
- meteo operativo, sensori e impianti;
- Magazzino autonomo multi-hotel con catalogo tecnico, categorie/ubicazioni gerarchiche, ledger, QR/barcode, seriali, compatibilità, inventario fisico, trasferimenti tra strutture e ricambi collegati agli interventi con prenotazione/consumo tracciato;
- modalità offline con outbox IndexedDB, retry controllato e gestione conflitti;
- diagnostica con codici incidente `RAND-XXXX`;
- ruoli e permessi centralizzati;
- PWA responsive per iOS, Android e Windows;
- App Shell Foundation, UI Components & Theme System e RandAI Contextual Integration completati;
- RandAI operativo fino al Blocco 32;
- RandAI Control Center — fondazione operativa completata;
- Reliability & Safety condivisa RandApp/RandAI fino al Blocco 39.

## Strategia piattaforme

- **iPhone/iPad:** PWA/Web App;
- **Android:** PWA/Web App oggi, architettura predisposta per un futuro APK Capacitor senza rifare la UI;
- **Windows:** PWA/Web App con layout desktop/sidebar.

La shell gestisce safe-area browser e inset nativi opzionali. Un futuro wrapper Android può alimentare `--rs-native-safe-*` tramite il bridge `randapp-system-insets`.

## UI — percorso consolidato

### Punto 1 — App Shell Foundation

- bottom navigation mobile a cinque slot: `Segnalazioni · Interventi · Home · Planning · Menu`;
- Home sempre nello slot centrale 3;
- permessi e visibilità non alterano la geometria della navbar;
- il `+` è un'azione separata dalle destinazioni;
- safe-area effettiva = massimo tra browser `env(safe-area-inset-*)` e inset nativi opzionali;
- Android 3 tasti, gesture navigation e Home Indicator iOS possono riservare lo spazio reale necessario;
- da 960px in su Windows/desktop usa la sidebar;
- Piccolo/Normale/Grande condividono la stessa architettura e usano `--rs-scale`.

File principali: `src/randapp/shell-navigation.js`, `src/randapp/system-insets.js`, `src/randapp/app-shell-foundation.css`, `docs/architecture/APP_SHELL_FOUNDATION.md`.

### Punto 2 — UI Components & Theme System

Il design system è light-first e mantiene `Sistema`, `Chiaro`, `Scuro`. Le superfici Material-inspired riusano i componenti `rs-*`; Liquid Glass resta limitato al chrome, Sheet e azioni dove migliora gerarchia e profondità. L'accento hotel è separato dai colori semantici e sono supportati reduced motion, contrasto aumentato e forced colors.

File principali: `src/randapp/ui-material-glass.css`, `src/randapp/theme.js`, `src/randapp/theme-coherence.css`, `docs/architecture/UI_COMPONENTS_THEME_SYSTEM.md`.

### Punto 3 — RandAI Contextual Integration

RandAI è parte nativa della shell. `RandAIContextBridge` pubblica struttura, utente e schermata corrente; una risorsa operativa può sovrascrivere il contesto generico. Segnalazioni, analisi, percorso guidato e Action Gateway condividono hotel e risorsa. PIN, token e dati personali non necessari sono esclusi dal contesto. Le scritture operative non bypassano l'Action Gateway.

File principali: `src/randai/context/RandAIContextBridge.jsx`, `src/randai/context/envelope.js`, `src/randai/randai-data.js`, `src/randapp/RandAISuggestion.jsx`, `src/randapp/InsertLauncher.jsx`, `docs/architecture/RANDAI_CONTEXTUAL_INTEGRATION.md`.

## RandAI — blocchi operativi 27–32

- **27 — Operational Context Layer:** hotel, utente, segnalazione, camera/area, apparecchiature, allegati, storico e procedure;
- **28 — Action Gateway:** permessi, rischio, conferma, esecuzione, verifica e audit;
- **29 — Persistent Task / Supervisor:** task persistenti e riprendibili collegati alla singola segnalazione;
- **30 — RandAI nelle Segnalazioni:** Analizza, Guidami, Procedura, Casi simili e conclusione tramite Gateway;
- **31 — Operational Learning:** memoria riutilizzabile solo da interventi verificati; nuove procedure restano bozze da approvare;
- **32 — Operational Prioritization & Dispatch:** ranking spiegabile, blocker e prossimo lavoro consigliato senza auto-assegnazioni fuori dal Gateway.

RandAI non deve inventare procedure operative mancanti, soglie tecniche non configurate o stati dispositivi non mappati.

## RandAI Control Center — fondazione operativa

La route protetta `/randai` è il centro operativo di RandAI. La fondazione espone sei moduli primari: `Overview`, `WhatsApp`, `Segnalazioni`, `Tecnici`, `Worker` e `Log`; i moduli avanzati già esistenti restano disponibili nella sezione Sistema.

La console usa la membership amministrativa reale per determinare le strutture accessibili e non replica una seconda matrice permessi nel frontend. La barra di stato mostra struttura attiva, connettività browser, stato dei dati Supabase, integrazione WhatsApp/Twilio e registro worker. Un servizio privo di una sorgente verificabile non viene mai mostrato come online.

`WhatsApp` e `Worker` sono fondazioni fail-closed: finché webhook e registro worker non sono configurati e verificati, la UI li indica esplicitamente come `Da collegare` e non simula inbox, esecuzioni o creazioni automatiche. La sezione WhatsApp legge esclusivamente la configurazione reale di `src/config.js`.

File principali: `src/randai/control/RandAIControlCenter.jsx`, `src/randai/control/randai-control.css`, `test/randai-control-center-foundation.test.js`.

## Reliability & Safety — blocchi 33–39

- **33 — Reliability Foundation:** envelope comune con operation/correlation/trace ID e contesto minimizzato;
- **34 — Context & Scope Guard:** preflight deny-by-default per hotel, attore, modulo, risorsa, ownership e permessi;
- **35 — Unified Validation & State Transition Layer:** primitive comuni e contratti di dominio;
- **36 — Safe Write Engine:** `preflight → idempotenza/precondizione → write → read-back → verifica`, senza retry nascosti;
- **37 — Authorization & RLS Verification Matrix:** RLS e privilegi browser irrigiditi; il database resta autorità definitiva;
- **38 — Audit & Reversible Operations:** audit append-only e soft-delete/restore dove previsto dal dominio;
- **39 — Offline, Retry & Concurrency Hardening:** outbox IndexedDB, lease cross-tab, jitter, idempotenza e gestione conflitti.

## Rifornimenti interni

Il modulo Rifornimenti è una bacheca operativa privata **Governanti → Manutentori**. Non è una chat e non confluisce nelle Segnalazioni di manutenzione.

- il catalogo è vuoto all'avvio ed è amministrabile per singolo hotel;
- le sole categorie sono `Minibar` e `Consumo`;
- Governante e Capo Governante selezionano i prodotti necessari e inviano la richiesta;
- non vengono gestite quantità: ogni prodotto è una singola voce richiesta;
- ogni voce nasce `pending` / **In attesa** e non esiste un pulsante o stato “Niente”;
- il Manutentore può scegliere esclusivamente **Consegnato** oppure **Manca**;
- se non viene premuto nessun pulsante, la voce resta in attesa;
- quando non rimangono voci in attesa, la richiesta si chiude automaticamente;
- l'Admin può aggiungere, disattivare, riattivare o eliminare prodotti; i prodotti già presenti nello storico sono protetti e vanno disattivati;
- gli aggiornamenti arrivano tramite Supabase Realtime, senza polling periodico o worker dedicati;
- `Manca` non modifica il Magazzino e non equivale automaticamente a giacenza zero.

Le tabelle `supply_products`, `supply_requests` e `supply_request_items` sono protette da RLS. Le scritture delle richieste e degli esiti passano dalle RPC `supply_create_request` e `supply_resolve_item`; `anon` non può eseguirle.

Permessi iniziali: Governante/Capo Governante `view+create`, manutentore `view+complete`, Admin `view+create+complete+manage`.

File principali Rifornimenti:

- `src/supply-data.js`
- `src/randapp/SupplyRequestsPortal.jsx`
- `src/randapp/supply-requests.css`
- `src/randapp/HousekeepingCompletionAlerts.jsx`
- `supabase/migrations/20260901123549_supplies_housekeeping_requests.sql`
- `test/supply-requests-contract.test.js`
- `docs/architecture/RIFORNIMENTI_INTERNI.md`

## Magazzino — principi

Il Magazzino è un dominio autonomo di RandApp. Manutenzioni, RandAI e altri moduli possono interrogarlo o allegare riferimenti, ma non possiedono né modificano direttamente la giacenza.

`quantity` è un saldo materializzato per lettura veloce. La fonte storica resta il ledger append-only `inventory_movements`: ogni variazione registra quantità prima/dopo, tipo, causale, ubicazione, riferimento, metadata e attore. I client autenticati non possono impostare direttamente il saldo.

### Blocco 1 — Catalogo e ledger

Fondazioni consolidate:

- categorie gerarchiche per hotel con sottocategorie, sinonimi, parole di guasto, azione tipica e schema di attributi tecnici ereditabile;
- ubicazioni gerarchiche `Magazzino → Zona → Scaffale → Ripiano/Cassetto`, con vincoli compositi anti cross-hotel;
- tipi articolo `consumabile`, `ricambio`, `attrezzatura`, `DPI`, `materiale`;
- produttore, modello, variante, SKU, barcode, tag, sinonimi, foto e attributi dinamici;
- campi tecnici `testo`, `numero`, `sì/no`, facoltativi o obbligatori, ereditati dalle categorie genitore;
- vocabolario guasti nel dominio Magazzino;
- movimenti `carico`, `scarico`, `consumo`, `trasferimento`, `rettifica`, `reso`, `inventario`;
- FK del ledger `RESTRICT`, quindi la storia non scompare eliminando un articolo;
- scorta minima, ideale e quantità di riordino con vista `inventory_reorder_status`;
- vista `inventory_ledger_reconciliation` per rilevare derive tra saldo e ledger;
- vecchio RPC `inventory_adjust_stock` mantenuto come wrapper compatibile sul nuovo `inventory_adjust_stock_v2`;
- RLS e permessi hotel-scoped; le RPC privilegiate verificano sessione e permesso server-side.

Il seed iniziale crea una tassonomia manutentiva compatta per ogni hotel e lascia `Da classificare` come contenitore sicuro per inserimenti rapidi.

### Blocco 2 — Identificazione, tracciabilità e inventario fisico

Il Blocco 2 estende il Magazzino senza creare un secondo sistema di stock.

#### QR, barcode e scanner

- ogni articolo riceve un `scan_code` RandApp stabile; anche le ubicazioni possono essere identificate con un proprio `scan_code`;
- il barcode del produttore/fornitore resta distinto dal codice interno RandApp;
- un QR RandApp contiene un deep-link alla PWA con `inventoryCode`, non credenziali o segreti;
- il QR può essere aperto direttamente dalla Fotocamera di sistema su iPhone;
- lo scanner interno usa `BarcodeDetector` quando il browser lo supporta;
- lettori USB/Bluetooth funzionano come tastiera e l'inserimento manuale resta sempre disponibile;
- la generazione SVG del QR avviene nella Edge Function autenticata `inventory-qr-label` usando `qrcode` server-side: nessuna libreria scanner pesante o CDN runtime viene caricata nel bundle React.

#### Attrezzature serializzate

`inventory_serial_units` traccia il singolo pezzo tramite:

- serial number;
- asset tag RandApp generato automaticamente;
- barcode facoltativo;
- ubicazione;
- stato `available`, `in_use`, `maintenance`, `retired`, `lost`;
- condizione `ok`, `attention`, `damaged`;
- note e storico temporale di creazione/aggiornamento.

La tabella seriali non possiede una quantità indipendente: la giacenza dell'articolo continua ad avere una sola fonte di verità.

#### Compatibilità

`inventory_compatibility` permette relazioni esplicite tra articoli dello stesso hotel:

- `compatible`;
- `equivalent`;
- `replaces`;
- `accessory`;
- `incompatible`.

Questo evita di codificare compatibilità in note libere e prepara il catalogo per suggerimenti futuri senza permettere a RandAI di inventare equivalenze.

#### Inventario fisico

Il conteggio segue un ciclo esplicito:

1. **Apri inventario** per intera struttura o ubicazione;
2. viene salvato uno snapshot della giacenza attesa;
3. ogni riga riceve il conteggio reale;
4. tutte le righe devono essere completate prima della chiusura;
5. **Chiudi e riconcilia** applica tutte le differenze in una singola transazione e genera movimenti `inventario` nel ledger;
6. un inventario aperto per errore può essere annullato esplicitamente senza modificare le giacenze.

Lo snapshot impedisce che il conteggio fisico venga confuso con una semplice modifica manuale del saldo.

#### Trasferimenti tra strutture

I trasferimenti sono volutamente in due fasi:

1. **Spedisci:** il magazzino sorgente viene scalato e il trasferimento passa a `in_transit`;
2. **Ricevi:** solo un utente autorizzato sul magazzino destinazione può confermare l'arrivo; solo allora la giacenza viene caricata a destinazione.

Ogni trasferimento conserva uno snapshot leggibile dell'articolo e un `catalog_key` comune. Se a destinazione lo stesso articolo esiste già, viene riconosciuto tramite `catalog_key`; se manca, viene creato automaticamente preservando il legame di catalogo e, quando possibile, mappando la categoria per codice.

Un trasferimento ancora `in_transit` può essere annullato dal magazzino sorgente: la quantità viene restituita atomicamente e viene scritto un movimento `transfer_cancel`. Un trasferimento già ricevuto non viene riscritto retroattivamente.

Questo modello mantiene una catena di custodia chiara e impedisce trasferimenti “silenziosi” che modificano due hotel senza conferma di ricezione.

#### Sicurezza Blocco 2

- tabelle nuove con RLS;
- riferimenti articolo/ubicazione vincolati allo stesso hotel;
- RPC di inventario e trasferimento `SECURITY DEFINER` non eseguibili da `anon`;
- ogni RPC verifica `auth.uid()` e il permesso `inventory/edit` sull'hotel pertinente;
- il mittente autorizza la spedizione/annullamento, il destinatario autorizza la ricezione;
- QR e asset tag non contengono segreti;
- il saldo continua a essere modificabile solo attraverso percorsi server-side controllati.

### Blocco 3 — Ricambi negli interventi

Il Blocco 3 collega il dominio Interventi al Magazzino senza permettere agli interventi di modificare direttamente `inventory_items.quantity`.

#### Richiesta, prenotazione e disponibilità

- `inventory_intervention_parts` collega ogni richiesta/ricambio all'intervento e all'hotel;
- un ricambio può essere `requested`, `reserved`, `consumed`, `released` o `cancelled`;
- il testo libero resta solo come fallback quando il pezzo non è ancora catalogato;
- se l'articolo è presente e disponibile, viene prenotato senza scalare la giacenza fisica;
- `inventory_available_stock` distingue `quantity` fisica, `reserved_quantity` e `available_quantity`;
- la prenotazione usa lock server-side e impedisce a due interventi di prenotare contemporaneamente l'ultimo pezzo disponibile;
- un'unità serializzata può essere associata alla prenotazione e non può essere prenotata da due interventi insieme.

#### Consumo confermato

La giacenza viene scalata solo quando il manutentore conferma **Usato**. `inventory_consume_intervention_part`:

1. blocca prenotazione e articolo;
2. verifica hotel, permesso e giacenza;
3. decrementa il saldo una sola volta;
4. crea un movimento `consumo` con `reason_code=intervention_part`, `reference_type=intervention` e `reference_id` dell'intervento;
5. collega il movimento alla riga ricambio;
6. aggiorna il campo legacy `pezzo_sostituito` dell'intervento con i ricambi realmente consumati.

“Non usato” libera la prenotazione senza toccare il saldo. “Annulla” chiude la richiesta. Un pezzo non disponibile può restare richiesto e venire associato/prenotato in seguito quando entra a catalogo o torna disponibile.

#### Chiusura e storico

- un intervento con ricambi `requested` o `reserved` non può essere chiuso;
- prima del completamento ogni ricambio deve diventare `consumed`, `released` oppure `cancelled`;
- il controllo esiste sia nella UI sia in un trigger database, quindi non è aggirabile da un client vecchio;
- un intervento con movimenti Magazzino consumati non viene eliminato distruttivamente dalla UI: il riferimento storico resta intatto;
- richieste/prenotazioni non consumate vengono annullate prima di una cancellazione consentita.

Questa separazione evita due errori frequenti: scaricare materiale solo perché era stato richiesto e lasciare prenotazioni fantasma dopo la chiusura di un intervento.

File principali Magazzino:

- `src/inventory-domain.js`
- `src/inventory-data.js`
- `src/inventory-block2-data.js`
- `src/inventory-intervention-data.js`
- `src/randapp/InventoryView.jsx`
- `src/randapp/InventoryBlock2Panel.jsx`
- `src/randapp/operations/InterventionsView.jsx`
- `src/randapp/inventory.css`
- `supabase/functions/inventory-qr-label/index.ts`
- `supabase/migrations/20260901082438_inventory_block1_foundation.sql`
- `supabase/migrations/20260901082525_inventory_block1_updated_at.sql`
- `supabase/migrations/20260901105000_inventory_block2_traceability_stocktake_transfer.sql`
- `supabase/migrations/20260901105500_inventory_block2_cancel_and_transfer_snapshot.sql`
- `supabase/migrations/20260901112200_inventory_block3_intervention_parts.sql`
- `test/inventory-domain.test.js`
- `test/inventory-block2-contract.test.js`
- `test/inventory-block3-intervention-parts.test.js`

## Parità e isolamento multi-hotel

Hotel Giò, Chocohotel e Hotel Il Brigantino condividono la stessa shell e le stesse funzioni generali. Una funzione non può essere nascosta solo perché l'hotel non è Giò.

Regole:

- funzioni permission-driven, non hotel-hardcoded;
- dati separati tramite `hotel_id` e RLS;
- cache/outbox mantengono il contesto hotel immutabile;
- Planning Sale è disponibile a ogni struttura autorizzata e usa configurazioni sale proprie;
- Housekeeping ha cache distinta per hotel;
- ntfy dichiara configurazioni per le tre strutture;
- differenze reali di camere, sale, impianti, sensori, contatti, magazzini e procedure restano specifiche della struttura.

Le regole camere di Hotel Giò sono specifiche di Giò e non vanno propagate alle altre strutture.

## Contratti operativi importanti

### Segnalazioni

Ricerca, stato e filtri avanzati sono combinabili. Ordinamenti disponibili: camera/zona, urgenza, stato, categoria e data. Le camere vengono ordinate numericamente. Una Segnalazione aperta pubblica il proprio Operational Context a RandAI.

### Magazzino

Ogni articolo appartiene a una sola struttura. Categorie, parentela articolo e ubicazioni usano riferimenti vincolati allo stesso `hotel_id`; i campi testuali legacy restano solo per compatibilità progressiva.

Carichi, scarichi, consumi, inventari, rettifiche e trasferimenti passano dal ledger/RPC. Seriali e compatibilità arricchiscono la tracciabilità, ma non possono creare una seconda giacenza. Le prenotazioni per interventi riducono la disponibilità senza modificare la giacenza fisica; solo la conferma `Usato` genera un movimento di consumo.

Il controllo file delle foto non forza la fotocamera: iOS, Android e Windows possono proporre Fotocamera, Libreria o File secondo le capacità del dispositivo.

### Presenza e UI size

`Sono in struttura` identifica una sola struttura fisica alla volta. I controlli devono funzionare in Piccolo, Normale e Grande e mantenere coerenza su iOS, Android e Windows.

## Architettura

- entry: `src/main.jsx`;
- shell/UI: `src/randapp/`;
- App Shell: `src/randapp/shell-navigation.js`, `src/randapp/system-insets.js`, `src/randapp/app-shell-foundation.css`;
- visual layer: `src/randapp/ui-material-glass.css`, `src/randapp/theme.js`, `src/randapp/theme-coherence.css`;
- Planning: `src/randapp/planning/`;
- Rifornimenti: `src/supply-data.js`, `src/randapp/SupplyRequestsPortal.jsx`, `src/randapp/supply-requests.css`;
- RandAI: `src/randai/`;
- RandAI Control Center: `src/randai/control/`;
- RandAI context: `src/randai/context/`;
- Magazzino: `src/inventory-domain.js`, `src/inventory-data.js`, `src/inventory-block2-data.js`, `src/inventory-intervention-data.js`, `src/randapp/InventoryView.jsx`, `src/randapp/InventoryBlock2Panel.jsx`, `src/randapp/operations/InterventionsView.jsx`;
- reliability: `src/reliability/`;
- Supabase client: `src/supabase.js`;
- session policy: `src/session-policy.js`;
- offline: `src/offline-store.js`;
- diagnostica: `src/diagnostics-client.js`, `src/diagnostic-taxonomy.js`, `src/error-boundary.jsx`;
- telemetria opzionale: `src/external-telemetry.js`;
- migrazioni: `supabase/migrations/`;
- Edge Functions: `supabase/functions/`;
- test: `test/` + `scripts/`.

Documenti principali:

- `FRONTEND_ARCHITECTURE.md`
- `docs/architecture/APP_SHELL_FOUNDATION.md`
- `docs/architecture/UI_COMPONENTS_THEME_SYSTEM.md`
- `docs/architecture/RANDAI_CONTEXTUAL_INTEGRATION.md`
- `docs/architecture/RIFORNIMENTI_INTERNI.md`
- `docs/architecture/RELIABILITY_SAFETY.md`
- `docs/architecture/VALIDATION_LAYER.md`
- `docs/architecture/SAFE_WRITE_ENGINE.md`
- `docs/architecture/AUTHORIZATION_RLS_MATRIX.md`
- `docs/architecture/AUDIT_REVERSIBLE_OPERATIONS.md`
- `docs/architecture/OFFLINE_RETRY_CONCURRENCY.md`

## Avvio locale

```bash
npm ci
npm run dev
```

Comandi di qualità:

```bash
npm run build
npm run test:matrix
npm run test:critical
npm test
npm run test:e2e
npm run test:device
```

`npm run test:quality` esegue matrice, gate critico e suite Node. La CI aggiunge build, budget bundle, Playwright Chromium/WebKit e device acceptance.

## Sicurezza

- nessuna funzione operativa deve perdere `hotel_id`;
- autorizzazione definitiva nel database, non nel frontend;
- le tabelle di servizio sensibili sono deny-by-grant per i ruoli browser;
- RPC privilegiate verificano sessione, hotel e permesso;
- il bucket foto manutenzione è privato;
- la chiave Supabase pubblicabile può stare nel client;
- service role, token, secret Edge Function, PIN e credenziali private non devono entrare nel repository;
- RandAI non esegue scritture bypassando l'Action Gateway;
- apprendimento e procedure distinguono evidenza verificata da suggerimenti/bozze.

## Configurazione

`src/supabase.js` contiene il progetto Supabase di produzione con chiave pubblicabile e consente override tramite `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Sentry e OpenTelemetry sono opzionali e vengono inizializzati solo se configurati e abilitati.

## Deploy

- **Vercel:** produzione ufficiale RandApp, collegata a `main`;
- **DigitalOcean:** test/staging;
- **Supabase:** backend, database, autenticazione, servizi RandAI e generazione etichette QR.

Il progetto Vercel attivo è `apicehotel-manutenzionr`.

## Regole di manutenzione

- non modificare migrazioni già applicate: aggiungere una nuova migrazione;
- non rimuovere indici solo perché momentaneamente segnalati `unused`;
- navigazione e autorizzazione restano separate;
- estrarre componenti condivisi solo quando riducono duplicazione reale o separano una responsabilità autonoma;
- ogni modifica critica deve mantenere verdi Quality Matrix, Critical Gate e test multipiattaforma;
- ogni modifica funzionale o architetturale che cambia il contratto documentato deve aggiornare questo README;
- un blocco RandAI/Reliability/Magazzino non è `DONE` finché codice, database, test, README e gate richiesti non risultano coerenti e verdi.
