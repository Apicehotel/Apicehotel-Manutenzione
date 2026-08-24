# RandApp — FRONTEND ARCHITECTURE

Consegna tecnica del nuovo frontend **RandApp Dark Shell** (branch `feature/randapp-dark-shell-rebuild`).
Questo documento permette a un altro sviluppatore/AI di continuare il frontend **senza dipendere da Emergent**.
Il progetto è una normale app **Vite + React 19 + Supabase**: `npm install && npm run dev`.

> Il Dark Shell è **APPROVATO e CONGELATO**. Non reintrodurre la vecchia UI (vedi §9).

---

## 1. Come si avvia (fuori da Emergent)

```bash
npm install          # oppure: yarn / pnpm install
npm run dev          # dev server Vite su :5173 (o :3000 con: npm start)
npm run build        # build di produzione in dist/
npm run preview      # anteprima della build
npm test             # test node:test (suite legacy)
```

- Entry HTML: `index.html` (root del repo).
- Entry JS: `src/main.jsx`.
- Nessuna variabile d'ambiente obbligatoria: la config Supabase ha fallback in `src/supabase.js`
  (override opzionale con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- **Nessuna libreria proprietaria Emergent.** Non è usato `emergentintegrations` né alcun servizio Emergent.
- Nota infra: nell'ambiente Emergent esiste `/app/frontend/package.json` (launcher per supervisor) ed è
  `gitignored`; non fa parte dell'app e può essere ignorato altrove.

---

## 2. Librerie realmente utilizzate

### Runtime (`dependencies`)
| Libreria | Versione | A cosa serve nel nuovo frontend |
|---|---|---|
| `react` | ^19.1.0 | Libreria UI (componenti, hook `useState/useEffect/useMemo`). |
| `react-dom` | ^19.1.0 | Render nel DOM (`createRoot` in `main.jsx`). |
| `@supabase/supabase-js` | ^2.57.0 | Client Supabase: auth PIN (edge functions), query dati, realtime. Istanza in `src/supabase.js`. |
| `dexie` | ^4.4.4 | Wrapper IndexedDB per la **cache offline**. Usato dai servizi dati riusati tramite `src/offline-store.js`. |
| `xlsx` | 0.20.3 | Export Excel/CSV. Oggi usato **solo** da `housekeeping.jsx` (sezione ancora da migrare); mantenuto per quella migrazione. |

### Build / dev / test (`devDependencies`)
| Libreria | Versione | A cosa serve |
|---|---|---|
| `vite` | ^7.1.0 | Bundler + dev server. |
| `@vitejs/plugin-react` | ^4.7.0 | Trasformazione JSX + Fast Refresh. |
| `playwright` | ^1.62.1 | Test end-to-end (`test/e2e.mjs`). |

### Cosa NON è usato (per scelta)
- **Nessun CSS framework** (niente Tailwind/Bootstrap): il design system è CSS puro con variabili.
- **Nessuna libreria di icone**: le icone sono **SVG inline** in `src/randapp/ui.jsx` (`Icon`).
- **Font**: Google Fonts `Manrope` + `Sora`, importati via `@import` in `src/randapp/shell.css`.
- **Nessun router**: il routing è a stato interno (vedi §6). Unica eccezione: la route `"/tecnico/:token"`
  gestita in `main.jsx` (portale tecnico legacy).

Audit dipendenze: **nessuna dipendenza risulta inutilizzata** → nulla è stato rimosso.

---

## 3. Design system e token — dove si trova

Tutto il design system vive in **`src/randapp/`** ed è namespacato con il prefisso classi **`rs-`**.
Il nuovo frontend importa **solo** `src/randapp/shell.css` (più i CSS funzionali di offline/feedback).
**Non** importa nessuno dei vecchi CSS (vedi §9).

```
src/randapp/
├── shell.css        # UNICO design system (token, componenti, temi, responsive, safe-area)
├── theme.js         # Tema: Sistema | Chiaro | Scuro  (chiave localStorage 'apicehotel.theme.v1')
├── ui-size.js       # Dimensione: Piccolo | Normale | Grande ('apicehotel.ui-size.v1')
├── ui.jsx           # Componenti base riutilizzabili + Icon SVG inline + ThemeControl/UiSizeControl
├── helpers.js       # Loghi, permessi (gate ruolo), costanti, formattazioni
├── nav.js           # Modello di navigazione + permessi (buildNav, NAV_TARGET, VIEW_GUARDS)
├── App.jsx          # Root: fasi login → selezione struttura → app; admin gate
├── Shell.jsx        # Frame autenticato: header, bottom nav, drawer, sidebar desktop, router
├── Home.jsx         # Dashboard
├── Issues.jsx       # Segnalazioni (lista, filtri, nuova, dettaglio, macchina a stati)
├── Settings.jsx     # Impostazioni admin (Utenti, Sensori, Ruoli/Navigazione, Aspetto)
├── Profile.jsx      # Profilo + Preferenze (Tema + Dimensione)
└── SoonScreen.jsx   # Placeholder Dark Shell per sezioni non ancora migrate
```

### Token del tema (in `shell.css`)
- **Base = Dark Shell**: definito su `:root` (fondo navy, superfici scure, testo chiaro, accenti cyan/teal/blu).
- **Light**: unico blocco `html[data-theme='light'] { … }` che **ridefinisce gli stessi token** (nessun
  componente duplicato). Stessa geometria, stessi componenti, stesse animazioni, solo colori diversi.
- Variabili chiave: `--rs-bg / --rs-bg-2`, `--rs-surface / -2 / -3`, `--rs-line / -strong`,
  `--rs-text / -2 / -3`, accenti `--rs-cyan / --rs-teal / --rs-blue`, `--rs-grad-primary`,
  chrome `--rs-header-bg / --rs-nav-bg / --rs-chrome-solid / --rs-overlay-bg`, ombre `--rs-shadow / --rs-glow`.
- **Scala interfaccia**: token `--rs-scale` (small `0.9`, normal `1`, large `1.14`) su
  `html[data-ui-size='…']`. `font-size` di root e i padding/altezze/nav/controlli usano `calc(px * var(--rs-scale))`,
  quindi la scala agisce su **font, controlli, card, spaziature e navigazione** su tutte le schermate.

---

## 4. Tema Dark / Light / System — come si usa

- Stato utente in `localStorage['apicehotel.theme.v1']`: `system | light | dark` (default **system**).
- `theme.js` risolve **System** in JS ascoltando `prefers-color-scheme` e imposta sul DOM sempre il valore
  **risolto**: `document.documentElement.dataset.theme = 'light' | 'dark'`. Così il CSS gestisce solo la
  variante `light` (single source), e "System" resta reattivo ai cambi di sistema.
- Init una volta sola in `main.jsx`: `initTheme()`.
- UI: usa il componente **`<ThemeControl />`** (in `ui.jsx`). È già presente in Profilo→Preferenze,
  nel drawer, nella sidebar desktop e nella tab "Aspetto" delle Impostazioni.
- API programmatica: `setThemeChoice('light'|'dark'|'system')`, `loadThemeChoice()`. Evento globale
  `apice-theme-changed`.

## 5. Dimensione Piccolo / Normale / Grande — come si usa

- Stato in `localStorage['apicehotel.ui-size.v1']`: `small | normal | large` (default **normal**).
- `ui-size.js` imposta `document.documentElement.dataset.uiSize`. Init in `main.jsx`: `initUiSize()`.
- UI: componente **`<UiSizeControl />`**. API: `setUiSize()`, `loadUiSize()`. Evento `apice-ui-size-changed`.
- **Tema e dimensione sono indipendenti e persistenti** (chiavi separate).

---

## 6. Stato globale, hook, routing

- **Nessuno store esterno** (no Redux/Zustand). Lo stato è React locale + `localStorage`.
- **Sessione**: `src/session.js` (chiave `apicehotel.session.v1`) → `loadSession/saveSession/clearSession`;
  emette l'evento `apice-session-changed`. `App.jsx` è la macchina a fasi:
  `login → (selezione struttura se multi-hotel) → app`.
- **Routing app**: stato `view` in `Shell.jsx` (nessun react-router). Le voci di menu producono un `view`
  o aprono le Impostazioni (mappa `NAV_TARGET`). `VIEW_GUARDS` blocca l'accesso diretto a sezioni non
  consentite dal ruolo.
- **Persistenza preferenze**: `theme.js`, `ui-size.js`.
- Hook riutilizzabili: `useLockScroll` (in `ui.jsx`, per sheet/modali). Gli altri sono hook standard React.

---

## 7. Componenti base riutilizzabili (`src/randapp/ui.jsx`)

Da usare SEMPRE al posto di markup ad-hoc (non duplicare nelle pagine):

| Componente | Uso |
|---|---|
| `Icon` | Icone SVG inline (set esteso). Niente emoji, niente librerie. |
| `Button` (`variant`: primary/ghost/outline/danger; `size`: sm/md/lg; `icon`,`iconRight`) | Pulsanti. |
| `IconButton` | Pulsante icona quadrato (header/azioni). |
| `Card` | Superficie/scheda (`rs-card`, opzione `rs-card--pad`). |
| `Field` + `TextInput` + `textarea .rs-textarea` + `select .rs-select` | Form. |
| `Badge` (`tone`: todo/waiting/tecnico/done/high/mid/low/accent) | Stati/etichette. |
| `Segmented` | Tab/filtri a segmenti. |
| `Sheet` | Bottom sheet mobile (usato dal **selettore struttura** e dal dettaglio segnalazione). |
| `Modal` + `ConfirmDialog` | Dialoghi centrati / conferme. |
| `EmptyState`, `Spinner` | Stati vuoti / caricamento. |
| `ThemeControl`, `UiSizeControl` | Selettori Preferenze. |

Struttura app (in `shell.css` + `Shell.jsx`):
- **Header**: `.rs-header` + `.rs-hotelchip` (logo struttura + utente/ruolo, cambio struttura).
- **Bottom navigation**: `.rs-bottomnav` + `.rs-navbtn` + FAB `.rs-navfab` (solo mobile/tablet).
- **Drawer**: overlay laterale `.rs-drawer` con header (logo/struttura/utente/ruolo/cambio struttura),
  gruppi di voci, Preferenze, Logout. Menu costruito da `buildNav()` filtrato per permessi.
- **Sidebar desktop**: `.rs-sidebar` persistente (≥1024px), stesso menu di `buildNav()`; l'header è nascosto.
- **Selettore struttura**: `HotelSelector` in `App.jsx` (post-login se >1 hotel) e `Sheet` "Cambia struttura".

---

## 8. Come creare una NUOVA schermata RandApp

1. Crea `src/randapp/MiaSezione.jsx` e usa **solo** i componenti di `ui.jsx` e le classi `rs-`.
   Non scrivere CSS inline strutturale né importare vecchi CSS.
2. Struttura tipica:
   ```jsx
   import { Card, Button, EmptyState, Spinner } from './ui.jsx'
   export default function MiaSezione({ user, hotel }) {
     return (
       <div data-testid="mia-view">
         <div className="rs-page-title"><div><h1>Titolo</h1><p>{hotel?.name}</p></div></div>
         <Card className="rs-card--pad">…</Card>
       </div>
     )
   }
   ```
3. Registra il render in `Shell.jsx` (`renderView`) sul relativo `view` id.
4. Aggiungi la voce nel menu in `src/randapp/nav.js` (`buildNav`) con il **gate di permesso** corretto
   (`helpers.js`) e, se serve, una guardia in `VIEW_GUARDS`.
5. I dati arrivano dai **servizi già esistenti** (§10): importa la funzione e usala in `useEffect`.
6. Ogni elemento interattivo/informativo deve avere un `data-testid`.
- Header/drawer/bottom nav sono **globali**: una nuova pagina non li ridisegna, vengono dallo `Shell`.

---

## 9. Responsive & safe-area (già gestiti dal design system)

- `index.html`: `viewport-fit=cover` + `interactive-widget=resizes-content` (tastiera virtuale non copre i campi).
- Altezze: `100dvh` (viewport dinamico mobile).
- Safe-area: `env(safe-area-inset-*)` in header, bottom nav, drawer, sheet, modali.
- Breakpoint: mobile (base) → tablet `≥768px` (drawer più largo, griglie) → desktop `≥1024px`
  (sidebar persistente, header nascosto, bottom nav nascosta) → `≥1280px` liste a 2 colonne.
- Compatibile iPhone/Android/PWA/tablet/desktop. **Non** usare unità fisse fuori dai token quando conta la densità.

---

## 10. Servizi dati riusabili (logica preservata — NON riscrivere)

Questi moduli contengono la logica/integrazioni esistenti e sono **UI-agnostici**: riusali così come sono.

| Modulo | Funzioni principali |
|---|---|
| `src/supabase.js` | istanza client (`supabase`, `supabaseUrl`, `isSupabaseConfigured`). |
| `src/session.js` | `loadSession/saveSession/clearSession` + evento sessione. |
| `src/auth-data.js` | `loginWithPin`, `loginAdmin`, `signOutSupabase`. |
| `src/users-data.js` | `fetchDirectory` (pubblica, per login), `fetchUsers`, `insertUser`, `updateUserRow`, `updateUserPin`, `setUserActive`, `permanentlyDeleteUser`, `getTechnicianLink`. |
| `src/issues-data.js` | `fetchIssues`, `insertIssue`, `updateIssueRow`, `deleteIssueRow`, `subscribeIssues` (realtime). |
| `src/urgents-data.js` | `fetchUrgents`, gestione avvisi urgenti. |
| `src/planned-data.js` | `fetchPlanned` (interventi/planning lavori). |
| `src/sale-data.js` | planning sale. |
| `src/sensors-admin-data.js` | `fetchAllSensors`, `updateSensorVisibility`, `syncSensorsFromEwelink`. |
| `src/feedback-data.js` | feedback. |
| `src/locations.js` | `HOTEL_LOCATIONS` (camere/zone per struttura). |
| `src/config.js` | `HOTELS`, `ROLES`, `ROLE_PERMISSIONS`. |
| `src/offline-store.js`, `src/photo-storage.js` | cache offline (dexie) e foto. |
| `src/offline-status.js`, `src/operation-feedback.js` | feedback offline/operazioni (CSS self-contained, importati in `main.jsx`). |
| `pwa.js`, `push.js`, `ntfy-profile.js`, `presence-status.js`, `urgent-ownership-guard.js` | init lato client (registrati in `main.jsx`). |

### Come collegare una vecchia funzione ai nuovi componenti (senza reintrodurre la vecchia UI)
1. Individua il **servizio dati** della funzione nella tabella sopra (es. `planned-data.js` per Interventi).
2. Crea la nuova schermata Dark Shell (§8) e chiama quelle funzioni; **non** importare il vecchio
   componente `.jsx` (es. NON importare `planning.jsx`/`housekeeping.jsx`).
3. Ricostruisci la UI con `Card/Button/Field/Segmented/Sheet/EmptyState` ecc.
4. Sostituisci il `SoonScreen` della sezione con la nuova schermata in `Shell.jsx`.
5. Verifica permessi in `nav.js` (già mappati dai gate originali).

---

## 11. Cosa del VECCHIO frontend NON va più riutilizzato

**Da NON importare/estendere** (restano nel repo solo finché le sezioni non sono migrate; poi rimovibili):
- `src/App.jsx`, `src/AppClean.jsx` — vecchi root/shell.
- `src/dark-shell-entry.js`, `src/unified-ui-*.js`, `src/admin-*.js` (montaggi imperativi DOM),
  `src/role-navigation-config.js` (versione imperativa; nel nuovo c'è la tab React in `Settings.jsx`).
- Vecchie schermate `.jsx` con markup/CSS legacy: `planning.jsx`, `housekeeping.jsx`, `temperature.jsx`,
  `sensors-panel.jsx`, `technician-portal.jsx` (quest'ultimo resta attivo SOLO sulla route `/tecnico/:token`
  con il suo `styles.css` caricato dinamicamente; migrarlo per ultimo).
- **Tutti i vecchi CSS**: `styles.css`, `clean-ui.css`, `approved-dark-shell.css`, `randapp-*.css`,
  `unified-ui-*.css`, override vari. **Non importarli** nel nuovo frontend: usare solo `randapp/shell.css`.

Regola d'oro: la logica (`*-data.js`, `session.js`, `auth-data.js`, `config.js`, `locations.js`) **si riusa**;
la UI (`App.jsx`, componenti `.jsx` legacy, tutti i CSS legacy) **si sostituisce** con i componenti `randapp/`.

---

## 12. Note di sicurezza / vincoli
- Non modificare backend, schema, RLS, credenziali o autenticazione Supabase.
- Nessun account demo / PIN hardcoded / bypass auth.
- Lavorare solo su `feature/randapp-dark-shell-rebuild`; **non** toccare `main`. Push via feature "Save to GitHub".
