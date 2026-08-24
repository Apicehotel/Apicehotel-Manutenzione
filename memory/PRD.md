# RandApp — Dark Shell rebuild (feature/randapp-dark-shell-rebuild)

## Problem statement (sintesi)
Rebuild del FRONTEND dell'app React esistente ApiceHotel/Apicehotel-Manutenzione, mantenendo
integralmente logica e integrazioni (Supabase, auth PIN, utenti/ruoli/permessi, strutture,
segnalazioni, interventi, planning, housekeeping, sensori/eWeLink). Eliminare il vecchio sistema
grafico e i CSS accumulati. Nuovo design system unico "RandApp Dark Shell", mobile-first e responsive.
Branch: feature/randapp-dark-shell-rebuild. NON toccare main.

## Stack
- Vite 7 + React 19 (app a root /app, NON struttura CRA). Backend = Supabase (progetto MultiHotel,
  config nel repo `src/supabase.js`). Nessun backend custom.
- Preview servita da Vite su :3000 gestita da supervisor tramite launcher isolato `/app/frontend`
  (gitignored). vite.config: host true, allowedHosts true.

## Architettura del rebuild
- Design system unico: `src/randapp/shell.css` (classi namespaced `rs-`, nessun CSS legacy importato).
- Primitive riutilizzabili: `src/randapp/ui.jsx` (Icon SVG inline, Button, Card, Field, TextInput,
  Badge, Segmented, Sheet, Modal, ConfirmDialog, EmptyState, Spinner).
- `src/randapp/helpers.js` logo/permessi/costanti.
- Screens: `App.jsx` (login + admin gate + hotel selector + phase machine), `Shell.jsx`
  (header + bottom nav + drawer + sidebar desktop + router), `Home.jsx`, `Issues.jsx`,
  `Settings.jsx`, `SoonScreen.jsx`.
- Entry `src/main.jsx` importa SOLO shell.css (+ offline/operation-feedback css). Il vecchio
  `styles.css` viene caricato dinamicamente SOLO sulla route `/tecnico/:token` (portale tecnico legacy).
- Logica preservata riusando i moduli dati esistenti invariati: issues-data, urgents-data,
  planned-data, users-data, auth-data, sensors-admin-data, session, locations, config.

## Implementato (2026-06 — passaggio 1)
- Login RandApp Dark Shell (logo, RandApp/Manutenzione, autocomplete Utente da directory Supabase,
  PIN 4 cifre, ACCEDI, link Impostazioni con gate PIN admin 6 cifre). Nessun account/PIN demo, nessun bypass.
- Selezione struttura post-login: 1 struttura → ingresso diretto; >1 → selettore con loghi RandApp.
  Cambio struttura anche da header chip / drawer.
- Home: header struttura, saluto, 3 stat reali (segnalazioni aperte / urgenti / interventi oggi),
  azioni rapide, attività recenti (dati Supabase reali).
- Segnalazioni COMPLETE: lista con ricerca + filtri per stato (todo/waiting/tecnico/done) con conteggi,
  nuova segnalazione (autocomplete camera/zona da locations, stato camera, urgenza, categoria, foto),
  dettaglio con macchina a stati completa (serve pezzo / pezzo sostituito / chiedi tecnico / completa /
  pezzo arrivato / completa-tecnico), eliminazione con conferma, realtime subscribe.
- Bottom nav + drawer + sidebar desktop + safe-area + dvh + interactive-widget=resizes-content.
- Impostazioni ridisegnate Dark Shell: Utenti (CRUD, ruoli, toggle strutture, reset PIN, attiva/disattiva,
  link tecnico), Sensori (visibilità per struttura + sync eWeLink), Ruoli & Navigazione (matrice permessi +
  editor posizionamento navigazione su app_config).

## Stato build/test
- `npm run build` OK (108 moduli). prebuild patch + hotel-switch test: 5/5 OK.
- `npm test`: 88/99 pass. Gli 11 fail sono PRE-ESISTENTI sul branch (verificato su baseline HEAD,
  identici) e riguardano feature del vecchio frontend NON ancora migrate (Planning lavori/Sale,
  Housekeeping, Feedback realtime, service worker/push, tema legacy, sale-data, insertUrgent).
  Il rebuild NON introduce regressioni.

## Backlog / prossimi passaggi
- P1: Migrare nel Dark Shell le sezioni ancora placeholder riusando la logica esistente:
  Interventi (planned-data), Planning Sale (sale-data), Housekeeping, Temperature (sensori),
  Avvisi urgenti (urgents-data + sirena), Rubrica tecnici.
- P1: Far passare gli 11 test legacy man mano che le rispettive UI vengono migrate.
- P2: Portale tecnico (/tecnico/:token) nel Dark Shell (oggi ancora su styles.css legacy).
- P2: Profilo utente (cambio PIN/telefono via auth-data) e sezione Feedback.
- Passaggio 2 (richiesto dall'utente): fedeltà visiva rispetto agli screenshot approvati.

## Note
- Non sono state create credenziali di test (per vincolo utente). Login/PIN richiedono account reali Supabase.
- Push su GitHub: da fare dall'utente con "Save to Github". NON eseguire merge su main.
