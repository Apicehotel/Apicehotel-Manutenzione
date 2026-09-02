# RandApp - Manutenzione

PWA React/Vite per la gestione operativa e manutentiva multi-hotel di Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Stato attuale

RandApp usa un unico progetto Supabase multi-hotel. Separazione dati tramite `hotel_id`, membership, RLS, vincoli relazionali e test cross-hotel. L'autenticazione PIN è server-side.

Funzioni consolidate:

- Segnalazioni, foto, storico, filtri, priorità, presa in carico e completamento;
- Interventi, Planning Lavori, Planning Sale, Housekeeping e Rifornimenti interni;
- notifiche push/ntfy, meteo operativo, sensori e impianti;
- Magazzino autonomo con catalogo, categorie/ubicazioni, ledger, QR/barcode, seriali, compatibilità, inventario fisico, trasferimenti e ricambi collegati agli interventi;
- offline/outbox IndexedDB, retry controllato, diagnostica e audit;
- PWA responsive su iOS, Android e Windows;
- RandAI operativo fino al Blocco 32 e Reliability & Safety fino al Blocco 39;
- RandAI Control Center completato fino al **Punto 5**.

## RandAI — Blocco 1 (Core 1–4)

Il primo blocco della roadmap RandAI è la fondazione interna su cui devono poggiare i blocchi successivi:

1. **Core / Orchestrator** — task con transizioni terminali esplicite; anche un errore generato dal registry chiude il task in `FAILED`, evitando task logicamente zombie in `RUNNING`.
2. **Tool Registry** — registrazione e discovery capability-driven, rischio/permesso espliciti, health check, timeout, retry solo quando sicuro e configurazione di retry normalizzata/immutabile. Parametri e filtri non validi vengono rifiutati fail-fast.
3. **Skill Engine** — lifecycle controllato `DRAFT → CANDIDATE → TESTED → APPROVED`, progressive disclosure e accesso esclusivo ai tool dichiarati dalla skill.
4. **Directive Composer** — testo originale preservato, struttura rules/forbidden/success criteria, approvazione esplicita, versionamento e promozione a candidate skill solo dopo approvazione.

Principi del blocco: nessun framework agentico esterno nel core se non porta un vantaggio netto, nessun doppione per la stessa responsabilità, compatibilità con i moduli RandAI successivi e test di regressione dedicati. Le parti esistenti `core`, `tools`, `skills` e `directives` sono quindi mantenute come sorgenti canoniche; una componente viene rimossa come zombie solo quando esiste evidenza che non è più referenziata o che duplica una responsabilità già coperta.

Test principali: `test/randai-core-tool-registry.test.js`, `test/randai-skills-directives.test.js`.

## Piattaforme

- **iOS/iPadOS:** PWA/Web App;
- **Android:** PWA/Web App, predisposta per wrapper Capacitor;
- **Windows:** PWA/Web App con layout desktop/sidebar.

La shell gestisce safe-area browser e inset nativi opzionali. Le funzioni sono permission-driven, non hotel-hardcoded.

## RandAI Control Center

Route protetta: `/randai`.

Moduli operativi: `Overview`, `WhatsApp`, `Segnalazioni`, `Tecnici`, `Worker`, `Log`.

Moduli di sistema: `Manutenzioni`, `Conoscenze`, `Bozze`, `Approvazioni`, `Archivio`, `Impianti`, `Scadenze`, `Regole`, `Anomalie`, `Costi & Osservabilità`, `Media & Drive`, `Sensori`.

L'accesso alla console richiede membership attiva con `can_access_admin = true`. Il database resta l'autorità finale: la UI non sostituisce RLS, RPC o Action Gateway.

### Punto 1 — Fondamenta console

- shell amministrativa unica dentro RandApp;
- hotel attivo e permessi verificati;
- health bar per browser, Supabase e WhatsApp;
- nessun servizio mostrato online senza una fonte verificabile.

File principali: `src/randai/control/RandAIControlCenter.jsx`, `src/randai/control/randai-control.css`.

### Punto 2 — WhatsApp end-to-end

Ingresso ufficiale: `POST /api/whatsapp/incoming` → Edge Function `randai-whatsapp-inbound`.

Canali configurati:

- Hotel Giò: `+390759978247`;
- Chocohotel: `+390759970610`;
- Brigantino: nessun numero configurato.

Regole principali:

- firma Twilio validata server-side;
- `MessageSid` idempotente;
- foto salvata subito nel bucket privato `maintenance-photos`;
- `receive_enabled` e `ingestion_enabled` separati;
- pausa = ricezione attiva ma nessuna Segnalazione automatica;
- nessun retro-import automatico dei messaggi ricevuti in pausa;
- posizione/guasto non vengono inventati;
- messaggi incompleti diventano `needs_info`;
- azioni manuali: crea Segnalazione, collega a esistente, ignora.

File principali: `api/whatsapp/incoming.js`, `src/randai/control/WhatsAppConsole.jsx`, `supabase/functions/randai-whatsapp-inbound/index.ts`, migrazioni `20260901231000`, `20260901232000`, `20260901234500`.

### Punto 3 — Segnalazioni operative RandAI

RandAI usa lo stesso dominio `segnalazioni` di RandApp. WhatsApp e App confluiscono nello stesso caso operativo.

La workspace mostra:

- camera/zona, descrizione, foto, autore, priorità, stato;
- assegnazione, tecnico, ricambi e cronologia;
- timeline unificata RandApp + WhatsApp;
- casi simili solo della stessa struttura;
- procedure esclusivamente `approved`;
- impianti/documenti correlati solo da evidenza esistente.

Le scritture passano dall'Action Gateway: `issue.update_priority`, `issue.set_waiting_part`, `issue.mark_done`, con `prepare → conferma → execute → verifica`.

File principali: `src/randai/control/IssueOperationsConsole.jsx`, `src/randai/control/issue-operations-core.js`, `src/randai/action-gateway.js`, `test/randai-issue-operations.test.js`.

### Punto 4 — Tecnici, autorizzazioni e interventi esterni

Workflow: **richiesta → autorizzazione → tecnico → link sicuro → intervento → chiusura interna**.

Regole:

- Manutenzione può richiedere un tecnico;
- autorizzazione finale solo a Direzione, Direttore Centro Congressi o Reception;
- tecnici con competenze many-to-many;
- link per singola richiesta con token salvato solo come hash e con scadenza;
- il tecnico può comunicare arrivo, inizio, note e fine intervento;
- il tecnico non può chiudere direttamente la Segnalazione;
- la fine intervento porta a `awaiting_internal_close` e richiede verifica interna;
- vecchi token tecnico pre-Punto-4 revocati e trasformati in hash non riutilizzabili;
- dispatch WhatsApp fail-closed se template/credenziali non sono disponibili.

Route interne: `/tecnici-esterni`; portale esterno: `/tecnico/<token>`.

File principali: `src/randai/control/TechnicianOperationsConsole.jsx`, `src/randapp/TechnicianDispatchPortal.jsx`, `src/technician-portal.jsx`, `supabase/functions/tech-portal/index.ts`, `supabase/functions/send-tecnico-whatsapp/index.ts`, `test/randai-technician-dispatch.test.js`.

### Punto 5 — Centro controllo RandAI

Il Punto 5 sostituisce i placeholder Worker/Log con fonti operative reali.

#### Worker

La console legge direttamente `pg_cron` e `cron.job_run_details`: nome job, schedule, ultima esecuzione, esito, errori recenti e prossima esecuzione calcolabile. Non esiste un registro manuale che possa dichiarare falsamente un Worker online.

Job attivi rilevati al completamento del Punto 5:

- `presence-auto-expire-7h20` — ogni minuto;
- `pulisci-richieste-urgenti-72h` — ogni ora;
- `sync-sensori-temperatura-secure` — ogni 30 minuti;
- `weather-alert-worker-2h-daytime` — ogni 2 ore nella finestra diurna configurata;
- `diagnostic-retention-daily` — giornaliero.

Il retry manuale è **allowlist-only** e disponibile esclusivamente per i due Worker operativi sicuri `weather-alert-worker-2h-daytime` e `sync-sensori-temperatura-secure`. La RPC esegue il comando già registrato in `pg_cron`, registra l'invio in `operational_audit_log` e in `randai_worker_runs`; non accetta comandi arbitrari dal browser.

#### Regole

Il Centro controllo non crea una seconda matrice di policy. Legge:

- `randai_action_gateway_settings` per struttura;
- `randai_autonomy_policies` per le policy di autonomia esistenti.

#### Anomalie

La snapshot server-side aggrega soltanto anomalie verificabili:

- run Worker falliti;
- messaggi WhatsApp `error` o `needs_info`;
- knowledge gap aperti;
- azioni RandAI fallite/negate/rifiutate.

La finestra è selezionabile tra 6 ore, 24 ore, 3 giorni e 7 giorni.

#### Audit

`Log` unifica in sola lettura:

- `operational_audit_log`;
- `randai_action_audit`.

I record sono filtrati sugli hotel realmente accessibili all'utente.

#### Costi e osservabilità

La console usa `randai_observability_traces`. Token e costi sono mostrati solo se effettivamente registrati. Un costo USD viene visualizzato soltanto quando la traccia contiene un valore provider esplicito `cost_usd`; in assenza del dato viene mostrato **Non disponibile**. Nessun prezzo viene ricostruito o stimato da listini esterni.

La RPC `randai_control_snapshot` è `SECURITY DEFINER`, richiede `auth.uid()`, membership attiva e `can_access_admin`; un `p_hotel_id` fuori scope viene rifiutato.

File principali Punto 5:

- `src/randai/control/SystemControlConsole.jsx`;
- `src/randai/control/system-control-console.css`;
- `src/randai/control/control-center-core.js`;
- `supabase/migrations/20260902051500_randai_point5_control_center.sql`;
- `supabase/migrations/20260902052500_randai_point5_worker_retry_heartbeat.sql`;
- `test/randai-control-center-point5.test.js`.

## RandAI — blocchi operativi 27–32

- **27 Operational Context Layer:** hotel, utente, Segnalazione, camera/area, apparecchiature, allegati, storico, procedure;
- **28 Action Gateway:** permessi, rischio, conferma, esecuzione, verifica, audit;
- **29 Persistent Task / Supervisor:** task persistenti e riprendibili;
- **30 RandAI nelle Segnalazioni:** analisi e guida dentro il caso operativo;
- **31 Operational Learning:** apprendimento solo da interventi verificati; nuove procedure restano bozze;
- **32 Operational Prioritization & Dispatch:** ranking spiegabile senza assegnazioni automatiche fuori Gateway.

RandAI non inventa procedure mancanti, soglie tecniche non configurate, stati dispositivi non mappati, costi non registrati o diagnosi certe senza evidenza.

## Reliability & Safety — blocchi 33–39

- **33** envelope comune e contesto minimizzato;
- **34** scope guard deny-by-default;
- **35** validazione e transizioni di stato comuni;
- **36** safe write: preflight → idempotenza/precondizione → write → read-back → verifica;
- **37** matrice RLS/privilegi;
- **38** audit append-only e operazioni reversibili dove previste;
- **39** offline, retry e concorrenza con outbox IndexedDB e lease cross-tab.

## Magazzino

Dominio autonomo e multi-hotel. La fonte storica è `inventory_movements`; `quantity` è un saldo materializzato. Supporta catalogo tecnico, categorie/ubicazioni gerarchiche, QR/barcode, unità serializzate, compatibilità esplicite, inventario fisico, trasferimenti a due fasi e ricambi negli interventi con prenotazione/consumo tracciato.

Gli interventi non modificano direttamente la giacenza. Solo la conferma server-side del consumo produce un movimento di ledger.

## Sicurezza

- nessuna operazione perde `hotel_id`;
- autorizzazione definitiva nel database;
- RPC privilegiate verificano sessione, hotel e permesso;
- tabelle sensibili deny-by-grant/RLS;
- service role, PIN e secret non entrano nel client o nel repository;
- webhook Twilio validati server-side;
- RandAI non bypassa l'Action Gateway;
- token portale tecnico nuovi salvati solo come hash;
- retry Worker limitato a job allowlistati.

## Architettura principale

- entry: `src/main.jsx`;
- shell/UI: `src/randapp/`;
- RandAI: `src/randai/`;
- RandAI Control Center: `src/randai/control/`;
- Supabase client: `src/supabase.js`;
- Edge Functions: `supabase/functions/`;
- migrazioni: `supabase/migrations/`;
- test: `test/` + `scripts/`;
- affidabilità: `src/reliability/`;
- Magazzino: `src/inventory-*.js` + UI `src/randapp/Inventory*`.

## Inserimenti contestuali (`+`)

Il pulsante `+` della shell non apre più un catalogo generico uguale in ogni schermata. La sorgente unica è `src/randapp/contextual-add.js`, che combina **pagina corrente + permessi + disponibilità della funzione**.

Regole operative:

- `Home`: mostra solo le principali creazioni realmente consentite;
- `Segnalazioni`: apre direttamente **Nuova segnalazione**;
- `Interventi` e `I miei lavori`: apre direttamente **Nuovo lavoro**;
- `Planning`: propone soltanto Lavori/Sale realmente autorizzati;
- `Avvisi urgenti`: apre direttamente **Nuovo allarme**;
- `Rubrica tecnici`: apre direttamente **Nuovo tecnico**;
- pagine con un proprio composer già visibile (`Magazzino`, `Rifornimenti`, `Promemoria`) non ricevono un secondo `+` globale duplicato;
- pagine senza un'azione di creazione coerente (`Housekeeping`, `Sensori`, `Impianti`, Profilo, Manuale, Feedback in sola lettura) non mostrano il `+`.

La Rubrica tecnici usa ora la stessa fonte canonica del Punto 4: `external_technicians` + `external_technician_competencies`. Creazione e modifica passano dalle RPC `technician_manage_directory` e `technician_set_competencies`; la vecchia lista derivata dagli utenti con ruolo `Tecnico esterno` non è più la fonte della rubrica.

Test principale: `test/contextual-add-router.test.js`.

## Qualità

```bash
npm ci
npm run build
npm run test:matrix
npm run test:critical
npm test
npm run test:e2e
npm run test:device
```

La CI aggiunge bundle budget, Chromium/WebKit e device acceptance. Un Punto RandAI non è `DONE` finché codice, database, test, README e gate richiesti non sono coerenti e verdi.

## Deploy

- **Vercel:** produzione ufficiale RandApp e dashboard RandAI;
- **DigitalOcean:** staging/test quando disponibile nel workflow;
- **Supabase:** database, autenticazione, RPC, RandAI ed Edge Functions.

Progetto Vercel: `apicehotel-manutenzionr`.

## Regole di manutenzione

- non modificare migrazioni già applicate: aggiungere una nuova migrazione;
- non rimuovere indici solo perché momentaneamente `unused`;
- navigazione e autorizzazione restano separate;
- nessun fallback diretto al database quando un Gateway/RPC controllato nega l'operazione;
- ogni modifica critica deve mantenere verdi Quality Matrix, Critical Gate, test browser e device;
- se esiste una soluzione migliore e più sicura, sostituire quella precedente invece di aggiungere doppioni.
