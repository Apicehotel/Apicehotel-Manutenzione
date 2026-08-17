# Apicehotel Manutenzione

Applicazione React/Vite per la gestione manutenzioni multi-hotel di:

- Hotel Giò
- ChocoHotel
- Hotel Il Brigantino

Il progetto è completamente standalone e non dipende dal vecchio backend operativo di Hotel Giò.

## Architettura

Stack principale:

- React + Vite
- Supabase
- Vercel
- GitHub
- PWA
- Dexie per alcune funzioni offline
- Twilio / WhatsApp predisposto ma attualmente disattivato

## MultiHotel

Ogni dato operativo è associato a una struttura tramite `hotel_id`.

Gli utenti possono essere abilitati a una o più strutture tramite membership Supabase.

Le policy RLS impediscono accessi cross-hotel non autorizzati.

## Autenticazione

Il nuovo sistema utenti usa Supabase Auth con login tramite:

- nome utente
- PIN

Il PIN non deve essere salvato in chiaro nel frontend.

La gestione utenti prevede:

- nome libero
- ruolo
- reparto
- strutture abilitate
- telefono facoltativo
- email facoltativa
- utente attivo/disattivato

Il telefono usa formato internazionale E.164 con prefisso predefinito italiano `+39`, modificabile tramite selettore internazionale.

Email e telefono sono predisposti per future funzioni di recupero PIN e messaggistica.

## Supabase

Supabase è il backend principale standalone del progetto.

Sono già predisposti:

- Auth
- profili utenti
- membership multi-hotel
- RLS
- Segnalazioni V2
- allegati/foto
- richieste urgenti
- interventi
- planning
- housekeeping
- prenotazioni sale
- sensori
- tecnici
- notifiche
- Edge Functions
- audit sicurezza e performance

Le vecchie policy pubbliche legacy sono state rimosse.

Le tabelle riservate contenenti credenziali o configurazioni server-side non sono accessibili direttamente dal frontend.

## Segnalazioni

La nuova struttura definitiva usa `maintenance_issues`.

La vecchia tabella `segnalazioni` resta temporaneamente disponibile solo per backup e futura migrazione dei dati.

Le nuove segnalazioni dovranno essere adattate completamente al sistema Auth + membership + RLS.

## Foto

Le foto delle segnalazioni vengono gestite tramite Storage Supabase.

Bucket previsto:

`maintenance-photos`

Nel database vengono salvati i riferimenti ai file, non file binari.

## Housekeeping

Housekeeping deve utilizzare esclusivamente il Supabase MultiHotel.

Non deve esistere alcuna dipendenza runtime dal vecchio progetto Supabase Hotel Giò.

Le funzionalità offline possono continuare a usare Dexie come cache locale e outbox.

## Sensori temperatura

I sensori devono leggere e sincronizzare i dati attraverso il nuovo Supabase MultiHotel e le relative Edge Functions.

Non devono chiamare direttamente Edge Functions o database del vecchio progetto Hotel Giò.

## Notifiche

Le integrazioni sono predisposte ma attualmente disattivate:

- Push notifications: `false`
- Twilio / WhatsApp: `false`
- recupero PIN via email: `false`

Nessuna comunicazione esterna viene inviata finché i relativi flag restano disattivati.

## GitHub Push Bridge

Il progetto contiene un bridge server-side sotto:

`/api/github`

Variabili server-only:

- `GITHUB_APP_ID`
- `GITHUB_REPO`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_BRIDGE_SECRET`
- `GITHUB_PUSH_TOKEN`

Non utilizzare mai il prefisso `VITE_` per token o segreti.

Endpoint principali:

- `GET /api/github/health`
- `GET /api/github/test`
- `POST /api/github/write-file`

`write-file` deve usare prima `GITHUB_PUSH_TOKEN` e utilizzare la GitHub App solo come fallback.

Il branch di sviluppo predefinito è:

`feature/base-multihotel`

Il bridge accetta solo percorsi esplicitamente consentiti e non deve funzionare come proxy GitHub generico.

## Sicurezza

Regole principali:

- nessun token nel frontend
- nessun PIN in chiaro
- nessuna service role key esposta
- RLS attiva
- accesso ai dati limitato tramite membership
- segreti solo server-side
- nessuna dipendenza operativa dal vecchio Hotel Giò
- modifiche GitHub preferibilmente su branch di sviluppo prima del merge in `main`

## Sviluppo

```bash
npm install
npm run dev
npm test
npm run build
