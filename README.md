# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target supportati e testati: **iOS/iPadOS, Android, tablet e Windows/desktop**.

## Stato attuale

RandApp è l'app operativa. RandAI è l'assistente e control layer integrato; RandMind, RandBrain, RandUI, RandCore, RandVisual, RandChange, RandGuide, Repo Radar e Warehouse sono moduli dell'ecosistema, non applicazioni parallele.

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

## Moduli principali

- **RandApp** — segnalazioni, interventi, planning, housekeeping, rifornimenti, magazzino, sensori e operatività hotel.
- **RandAI** — assistenza operativa, procedure, suggerimenti e control center.
- **RandMind** — continuità/memoria governata e hotel-scoped.
- **RandBrain** — reasoning/decision layer governato.
- **RandCore** — health, governance, workers, sicurezza, costi, integrazioni e LTS evidence.
- **RandVisual** — proiezioni visuali deterministiche e provenance.
- **RandChange** — receipt, Visual QA e certificazione modifiche.
- **RandGuide** — procedure e guide operative.
- **Repo Radar** — valutazione `Aggiungi / Sostituisci / Ignora` delle repository candidate.
- **Warehouse** — bounded domain magazzino collegato agli interventi, senza secondo inventario.

## Rifornimenti interni

Il modulo Rifornimenti resta separato dal Magazzino e non gestisce quantità: una richiesta indica soltanto quali prodotti servono; ogni voce resta `In attesa` finché il Manutentore la marca `Consegnato` o `Manca`.

Per **Hotel Giò (`hotelgio`)** il catalogo iniziale recupera i prodotti della precedente app “Rifornimento Office - Hotel Gio”:

- **Minibar:** Coca Cola, Succo ACE, Birra, Patatine, Barretta.
- **Consumo:** Saponetta, Shampini, Spugne scarpe, Cuffia doccia.

Il bootstrap è idempotente e non sovrascrive prodotti già personalizzati dall'Admin. ChocoHotel e Brigantino restano indipendenti e non ricevono automaticamente il catalogo di Giò.

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
- `docs/README-history-2026-09-05.md` — README storico completo con roadmap e dettagli dei blocchi precedenti.

Il README storico viene conservato integralmente: questa pagina rappresenta lo **stato corrente** dell'architettura e va mantenuta breve e operativa.
