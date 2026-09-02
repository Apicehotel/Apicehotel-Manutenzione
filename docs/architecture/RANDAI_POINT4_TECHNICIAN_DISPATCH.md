# RandAI Point 4 — Tecnici, autorizzazioni e interventi esterni

## Obiettivo

Un solo flusso verificabile collega una Segnalazione RandApp alla richiesta di tecnico esterno: richiesta, autorizzazione, invio, intervento, richiesta di chiusura e chiusura interna.

## Autorità

- Manutenzione può richiedere il tecnico.
- Direzione, Direttore Centro Congressi e Reception possono autorizzare o rifiutare.
- RandAI può osservare e assistere ma non acquisisce automaticamente l'autorità di dispatch.
- Il database e le Edge Function ripetono i controlli di hotel, membership e ruolo.

## Tecnici e competenze

`external_technicians` è l'anagrafica separata dagli utenti RandApp. Le competenze sono many-to-many tramite `technician_competencies` e `external_technician_competencies`.

## Accesso sicuro

Ogni autorizzazione genera una credenziale casuale legata a una sola richiesta e a un solo tecnico. In `technician_dispatch_tokens` viene conservato solo `token_hash`, insieme a scadenza, revoca e stato utilizzo. I link legacy pre-Punto-4 sono revocati e le credenziali storiche vengono sostituite irreversibilmente da hash.

## Portale tecnico

Il link `/tecnico/<token>` consente esclusivamente di leggere il lavoro autorizzato, indicare arrivo, avviare il lavoro, aggiungere note e comunicare la fine. La fine imposta `awaiting_internal_close`; non può impostare la Segnalazione a `done`.

## WhatsApp

`send-tecnico-whatsapp` convalida utente autorizzante, hotel, richiesta, tecnico, token hashato e scadenza prima dell'invio. Il template `richiesta_tecnico_portale` è obbligatorio quando richiesto dalla policy WhatsApp; se non è approvato il flusso fallisce chiuso.

## Audit

`technician_intervention_events` registra apertura link, arrivo, avvio, note e richiesta di chiusura. WhatsApp non è la fonte di verità dello stato intervento.

## File principali

- `src/randai/control/TechnicianOperationsConsole.jsx`
- `src/randapp/TechnicianDispatchPortal.jsx`
- `src/technician-portal.jsx`
- `supabase/functions/tech-portal/index.ts`
- `supabase/functions/send-tecnico-whatsapp/index.ts`
- `supabase/migrations/20260902014500_randai_point4_technician_dispatch.sql`
- `supabase/migrations/20260902015500_randai_point4_dispatch_notification.sql`
- `supabase/migrations/20260902020500_randai_point4_read_scope_and_issue_state.sql`
- `supabase/migrations/20260902034000_randai_point4_revoke_legacy_technician_tokens.sql`
- `test/randai-technician-dispatch.test.js`
