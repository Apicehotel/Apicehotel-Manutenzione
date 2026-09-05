# Rifornimenti interni

Il modulo Rifornimenti gestisce la comunicazione operativa Housekeeping → Manutenzione/Facchini per i soli prodotti **Minibar** e **Consumo**.

## Regole di dominio

- il catalogo è separato per `hotel_id`;
- **Hotel Giò (`hotelgio`)** riceve un bootstrap iniziale derivato dalla precedente app operativa “Rifornimento Hotel”;
- il catalogo canonico Hotel Giò contiene **7 Minibar**: Acqua naturale, Acqua frizzante, Coca Cola, Succo di frutta, Patatine, Barrette, Birre;
- contiene inoltre **9 Consumo**: Carta igienica, Saponette, Shampoo, Cuffie doccia, Spugne scarpe, Sacchi neri 60x50, Sacchi bianchi 60x50, Sacchi neri 110x70, Carta Lucart/Scottex;
- una migrazione correttiva preserva gli UUID delle voci bootstrap già create quando corregge i nomi precedenti;
- il bootstrap è hotel-scoped e non crea quantità né movimenti Warehouse;
- ChocoHotel e Brigantino non ereditano automaticamente il catalogo di Giò: restano hotel-scoped e configurabili quando saranno definiti i rispettivi prodotti reali;
- solo l'Admin aggiunge, modifica, disattiva o elimina prodotti;
- un prodotto già usato nello storico non viene eliminato distruttivamente: può essere disattivato;
- Governante e Capo Governante possono vedere il catalogo attivo e inviare richieste;
- per Governante e Capo Governante il numero personale nel profilo è obbligatorio prima di leggere o creare richieste operative;
- il numero non è la chiave di proprietà: la proprietà resta sempre `auth.uid()`; una Governante vede solo richieste create dal proprio account autenticato;
- Manutentore può leggere le richieste e assegnare a ogni voce solo `Consegnato` oppure `Manca`;
- se nessuno seleziona un esito, la voce resta `pending` / **In attesa**: non esiste uno stato “Niente”;
- non esistono quantità nel flusso: una voce indica che quel prodotto è richiesto;
- una richiesta viene chiusa automaticamente quando non contiene più voci `pending`;
- `Manca` significa che il prodotto non è stato consegnato, non che la giacenza Magazzino sia necessariamente zero;
- il modulo non modifica automaticamente il Magazzino e non genera movimenti di stock;
- gli aggiornamenti arrivano tramite Supabase Realtime, senza worker di polling.

## Sicurezza

Le tabelle `supply_products`, `supply_requests` e `supply_request_items` sono hotel-scoped e protette da RLS. Le richieste e i relativi esiti non sono scrivibili direttamente dai client autenticati: passano dalle RPC `supply_create_request` e `supply_resolve_item`, che verificano `auth.uid()` e `has_app_permission`.

Per i ruoli `Governante` e `Capo Governante` la RLS applica inoltre due vincoli:

1. deve esistere un numero personale non vuoto in `profiles.phone` per l'utente autenticato;
2. `supply_requests.requested_by` deve coincidere con `auth.uid()`.

La stessa regola di privacy per-account è applicata alle `segnalazioni`: una Governante con numero personale vede soltanto le segnalazioni create dal proprio account (`created_by_user_id = auth.uid()`). Senza numero non legge e non crea nuove segnalazioni.

Permessi iniziali:

- `Governante`: `supplies/view`, `supplies/create`;
- `Capo Governante`: `supplies/view`, `supplies/create`;
- `manutentore`: `supplies/view`, `supplies/complete`;
- `admin`: `supplies/view`, `supplies/create`, `supplies/complete`, `supplies/manage`.

Le RPC non sono eseguibili da `anon`.

## UI

`SupplyRequestsPortal` è montato nel contenitore operativo già presente nella shell. In questo modo il modulo è disponibile ai soli ruoli autorizzati senza aggiungere un nuovo worker o duplicare la navigazione.

La Governante vede i prodotti attivi raggruppati in Minibar e Consumo, seleziona le voci necessarie ed eventualmente aggiunge una nota. Il Manutentore vede ogni prodotto richiesto e può scegliere `✓ Consegnato` o `! Manca`. Le voci non toccate restano visivamente in attesa.

A Hotel Giò il catalogo viene inizializzato con i **16 prodotti storici reali** sopra elencati. Negli altri hotel il catalogo resta vuoto finché l'Admin della struttura non inserisce prodotti reali. Il numero personale si inserisce in **Il mio profilo → Contatti → Telefono**.

L'Admin, nello stesso pannello, gestisce il catalogo per la struttura corrente.

## File principali

- `src/supply-data.js`
- `src/randapp/SupplyRequestsPortal.jsx`
- `src/randapp/supply-requests.css`
- `src/randapp/HousekeepingCompletionAlerts.jsx`
- `supabase/migrations/20260901123549_supplies_housekeeping_requests.sql`
- `supabase/migrations/20260901130855_governanti_private_requests_and_phone_gate.sql`
- `supabase/migrations/20260905041921_seed_hotelgio_supply_catalog.sql`
- `supabase/migrations/20260905042146_correct_hotelgio_supply_catalog_from_legacy_app.sql`
- `test/supply-requests-contract.test.js`
- `test/supply-catalog-seed-contract.test.js`
- `test/governanti-private-visibility-contract.test.js`
