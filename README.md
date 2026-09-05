# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target supportati e testati: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato attuale

RandApp è l'app operativa. RandAI è l'assistente e control layer integrato; RandMind, RandBrain, RandUI, RandCore, RandVisual, RandChange, RandGuide, **RandChat**, **RandDesktop**, Repo Radar e Warehouse sono moduli dell'ecosistema, non applicazioni parallele.

La roadmap OpenCode + Diagram Design è chiusa **6/6**: RandAgent Runtime, Tool + Permission Gateway, RandMind Continuity + Model Router, RandVisual Engine, RandCore Visual Intelligence, RandChange Receipt + Visual QA.

## Confini architetturali

- `hotel_id`, membership e scope hotel sono obbligatori.
- Supabase RLS/RPC è l'autorità finale; nascondere una funzione nella UI non concede né revoca permessi.
- RandAI riceve soltanto contesto autorizzato e hotel-scoped.
- Nessun modello/frontend riceve `service_role`, PIN, refresh token o secret non necessari.
- Mutazioni protette passano da Safe Write / Action Gateway / audit.
- `UNKNOWN` e `STALE` non significano `HEALTHY`.
- Niente secondi sistemi per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario o rollback.
- Una parte viene eliminata come zombie soltanto dopo verifica di utilizzo e dipendenze.
- Se esiste una soluzione nettamente migliore, più semplice e più sicura, sostituisce quella debole invece di accumulare patch.

## RandUI Adaptive Layout

Il contratto UI è unico:

`Hotel scope → identità → permessi → interessi → device/input/orientamento → Piccolo/Normale/Grande → layout`

I **permessi** decidono cosa è autorizzato; gli **interessi** decidono priorità e ordine di ciò che è già autorizzato.

Breakpoints canonici:

- smartphone `<768px`;
- tablet `768–1199px`;
- desktop/Windows `>=1200px`.

Sono gestiti anche touch/pointer, portrait/landscape, safe-area, schermi stretti e monitor larghi. `Piccolo / Normale / Grande` è il solo contratto persistente di densità (`apicehotel.ui-size.v1`); Grande aumenta anche controlli e touch target, non soltanto il testo.

La geometria responsive canonica è in `src/randapp/adaptive-layout.css`. Il bottom-nav mantiene **Home nello slot 3** e **Altro nello slot 5**; gli slot 1, 2 e 4 vengono scelti tra funzioni autorizzate in base agli interessi.

## Safe-area iOS / Android

RandApp non usa una libreria notch separata. Il contratto è interno e condiviso:

- `viewport-fit=cover`;
- `env(safe-area-inset-*)`;
- `src/randapp/system-insets.js` per eventuali inset nativi/wrapper futuri;
- `adaptive-layout.css` come unica geometria responsive.

La safe-area superiore ha **un solo proprietario: l'header sticky**. Non viene applicata anche al contenitore app, evitando il doppio spazio su iPhone con notch/Dynamic Island. Il bottom inset resta non limitato per Home Indicator e navigazione Android.

## Home operativa

La Home è una schermata di lavoro, non un elenco di link.

Gerarchia corrente:

1. ruolo/interesse e saluto;
2. contatori operativi compatti;
3. **Cosa fare adesso**;
4. suggerimento RandAI;
5. scorciatoie aggiuntive nella vista Completa.

Quando sono presenti esattamente tre contatori, su smartphone restano su una sola riga. `Allarmi` indica il canale Avvisi urgenti ed è distinto dalle segnalazioni con urgenza `alta`.

Il FAB multi-azione non copre più le card della Home: la Home espone una azione esplicita **Nuova segnalazione**, autorizzata tramite il contratto già esistente `new-issue`. Le altre creazioni restano contestuali nelle rispettive sezioni.

La card `RandAI · Prossimo lavoro` è secondaria rispetto alla coda reale e mostra uno score esplicito `Priorità N`. Il CSS Home è centralizzato in `src/randapp/home-operational.css`, non embedded nei componenti.

## RandChat — core 9/9

RandChat riusa l'identità RandApp e non crea un secondo account. I **9/9 blocchi core** sono implementati senza Matrix e senza introdurre una seconda piattaforma utenti, procedure o IA.

### Group A — gruppi operativi

- `RandChat ON/OFF` per utente, amministrato dal pannello Utenti;
- capacità separata `Crea gruppi`;
- gruppi aziendali realtime con ruoli `owner / admin / member`;
- membership cross-hotel esplicita senza ampliare `hotel_memberships`;
- directory minimale ID/nome/hotel, senza email o telefono;
- retention gruppi **30/60 giorni** e messaggi marcabili **Conserva**;
- RLS/RPC come autorità finale e audit retention senza copia del testo eliminato.

### Group B — DM E2EE e Segnalazioni

- DM globali tra utenti RandChat, indipendenti dalla struttura attiva;
- E2EE v1 nativa browser: **ECDH P-256 + AES-GCM 256 + ECDSA P-256/SHA-256**;
- chiavi private non esportabili conservate soltanto nell'IndexedDB locale del dispositivo;
- Supabase conserva ciphertext, IV, chiavi pubbliche, firme ed envelope per-device, mai il body plaintext del DM;
- ogni invio deve includere una envelope per tutti i dispositivi attivi di entrambi i partecipanti;
- verifica della firma prima della decifratura;
- retention DM configurabile **1 / 7 / 15 giorni**, con cleanup automatico orario;
- promozione esplicita di un messaggio verificato — gruppo o DM — a **Segnalazione persistente**, usando i permessi e la pipeline già esistenti;
- `chat_issue_links` conserva solo il collegamento metadata tra sorgente chat e Segnalazione.

E2EE v1 non viene descritta come Signal-grade: non implementa Double Ratchet/forward secrecy o verifica indipendente dei device. Questi hardening possono sostituire il protocollo in futuro senza cambiare account, thread o UI.

### Group C — Procedure, RandAI e RandMedia

- una procedura **approvata RandGuide** può essere condivisa in un gruppo come snapshot versionato; un invitato cross-hotel vede soltanto ciò che è stato esplicitamente condiviso e non ottiene accesso al catalogo dell'hotel;
- un messaggio operativo può diventare una **bozza canonica RandGuide** (`randai_procedures.status = draft`) con revisione umana obbligatoria: nessun percorso chat pubblica automaticamente una procedura;
- RandAI può essere interrogata manualmente sul gruppo tramite il motore `randai-assistant` già esistente; il contesto è bounded e richiede contemporaneamente membership del gruppo e membership reale dell'hotel;
- **i DM non vengono mai forniti automaticamente a RandAI**;
- RandMedia espone un contratto provider unico: oggi il provider attivo è il bucket Supabase privato `randchat-media`; Telegram può essere aggiunto in seguito come adapter senza cambiare UI, DB o modello utenti;
- gruppi: allegati operativi protetti da membership/RLS;
- DM: foto, video, audio e documenti vengono cifrati AES-GCM **nel browser prima dell'upload**; chiave e IV del file vivono soltanto dentro il payload DM già E2EE;
- massimo **4 allegati per messaggio**, **20 MiB ciascuno** lato utente;
- retention/cancellazione chat mette gli oggetti media in una coda server-only; un worker orario elimina anche eventuali upload orfani, evitando media zombie.

Dettagli, threat model e invarianti: `docs/architecture/RANDCHAT.md`.

## RandDesktop — stampa nativa v1

RandDesktop è il guscio Electron per le postazioni Windows e riusa RandApp: non introduce una seconda UI operativa, un secondo account o un secondo database.

La stampa v1 include:

- shell Electron con `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` e `webSecurity: true`;
- `File → Stampa…` / `Ctrl+P` con dialog nativo del sistema operativo;
- `webContents.getPrintersAsync()` per l'elenco stampanti;
- `webContents.print()` con pagina predefinita della stampante e sfondi;
- stampa della vista corrente, privilegiando un `Sheet` operativo aperto (es. dettaglio Segnalazione);
- bridge `contextBridge` ristretto: nessun `ipcRenderer` grezzo nel renderer;
- motore per documenti strutturati con limiti, escaping e CSP `default-src 'none'`;
- nessun HTML arbitrario, nessun secret e nessuna stampa silenziosa in v1;
- renderer locale nelle build pacchettizzate; Vercel non viene caricato come renderer privilegiato di produzione.

La stampa silenziosa e la stampante predefinita per reparto restano future opzioni amministrative esplicite, non privilegi del renderer.

Dettagli: `docs/architecture/RANDDESKTOP_PRINTING.md`.

## Moduli principali

- **RandApp** — segnalazioni, interventi, planning, housekeeping, rifornimenti, magazzino, sensori e operatività hotel.
- **RandAI** — assistenza operativa, procedure, suggerimenti e control center.
- **RandMind** — continuità/memoria governata e hotel-scoped.
- **RandBrain** — reasoning/decision layer governato.
- **RandCore** — health, governance, workers, sicurezza, costi, integrazioni e LTS evidence.
- **RandVisual** — proiezioni visuali deterministiche e provenance.
- **RandChange** — receipt, Visual QA e certificazione modifiche.
- **RandGuide** — procedure e guide operative.
- **RandChat** — gruppi operativi, DM E2EE per-device, Procedure/RandAI autorizzati e RandMedia con provider intercambiabile.
- **RandDesktop** — shell Electron Windows/Desktop con capacità native ristrette, a partire dalla stampa.
- **Repo Radar** — valutazione `Aggiungi / Sostituisci / Ignora` delle repository candidate.
- **Warehouse** — bounded domain magazzino collegato agli interventi, senza secondo inventario.

## Rifornimenti interni

Il modulo Rifornimenti resta separato dal Magazzino e non gestisce quantità: una richiesta indica soltanto quali prodotti servono; ogni voce resta `In attesa` finché il Manutentore la marca `Consegnato` o `Manca`.

Per **Hotel Giò (`hotelgio`)** il catalogo iniziale è allineato alla precedente app operativa **Rifornimento Hotel**:

- **Minibar (7):** Acqua naturale, Acqua frizzante, Coca Cola, Succo di frutta, Patatine, Barrette, Birre.
- **Consumo (9):** Carta igienica, Saponette, Shampoo, Cuffie doccia, Spugne scarpe, Sacchi neri 60x50, Sacchi bianchi 60x50, Sacchi neri 110x70, Carta Lucart/Scottex.

La migrazione correttiva preserva gli UUID già creati per le voci rinominate e aggiunge solo ciò che mancava. ChocoHotel e Brigantino restano indipendenti e non ricevono automaticamente il catalogo di Giò. Nessuna voce Rifornimenti genera quantità o movimenti Warehouse.

Rifornimenti usa inoltre un **contesto operativo Area + Piano** condivisibile con Housekeeping. A Hotel Giò la fonte canonica contiene `Jazz P1–P4` e `Wine P1–P4`. La selezione resta memorizzata per utente e hotel; le nuove richieste salvano lo snapshot Area/Piano e mostrano al Manutentore la destinazione. Dove esistono piani configurati il database rifiuta una nuova richiesta priva di contesto. Gli hotel non ancora configurati continuano a funzionare senza regressioni.

## Quality Matrix e test

Comandi principali:

```bash
npm run build
npm test
npm run test:quality
npm run test:e2e
npm run test:device
npm run test:lts
```

La CI certifica, tra gli altri:

- dependency/security audit;
- Quality Matrix;
- critical operational gate;
- multi-hotel parity;
- production confidence;
- build e bundle budget;
- RandUI/RandAI/RandCore contracts;
- RandChat E2EE round-trip e tamper detection;
- RandMedia E2EE file round-trip e compatibilità payload DM v1→v2;
- confini Group C Procedure/RandAI/RandMedia e ACL anonime;
- contratto RandDesktop printing: sandbox, IPC ristretto, escaping/CSP e blocco stampa silenziosa;
- Chromium + WebKit;
- device acceptance;
- RandCore health evidence;
- Rand Ecosystem LTS attestation.

## Deploy

Repository: `Apicehotel/Apicehotel-Manutenzione`.

Produzione: Vercel. Per prove operative e cambiamenti rischiosi resta preferibile un ambiente di test prima della produzione.

## Documentazione

- `docs/randui-adaptive-layout.md` — contratto adattivo device/interessi/densità.
- `docs/architecture/RIFORNIMENTI_INTERNI.md` — contratto operativo e sicurezza del modulo Rifornimenti.
- `docs/architecture/RANDCHAT.md` — architettura RandChat, E2EE, Procedure/RandAI, RandMedia e retention.
- `docs/architecture/RANDDESKTOP_PRINTING.md` — shell Electron, sicurezza IPC e stampa nativa v1.
- `docs/README-history-2026-09-05.md` — README storico completo con roadmap e dettagli dei blocchi precedenti.

Il README storico viene conservato integralmente: questa pagina rappresenta lo **stato corrente** dell'architettura e va mantenuta breve e operativa.
