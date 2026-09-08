# RandApp - Manutenzione / RandAI — Hotel Operations Platform

PWA React 19 + Vite 7 + Supabase/Postgres per operatività multi-hotel. Target: iOS/iPadOS, Android, tablet e Windows/desktop.

## Stato attuale
RandApp è l'app operativa. RandAI, RandMind, RandBrain, RandUI, RandCore, RandControl, RandGuide, RandSkills, RandChat, RandDesktop, Repo Radar e Warehouse sono moduli dello stesso ecosistema, non app parallele. Regola: un solo proprietario canonico per capacità; una soluzione migliore sostituisce quella debole invece di accumulare patch.

## RandUI
Flusso canonico:
`Page Schema → Template Resolver → Template Registry → Layout Contract → Component Registry → Foundation → Shell`

Il catalogo copre **24/24 destinazioni** con 14 template. Il Punto 2 introduce `layout-contract.js`: ogni pagina eredita una policy misurabile di larghezza (`wide`, `reading`, `center`), ritmo (`compact`, `normal`, `comfortable`), densità e comportamento responsive dal proprio template. La Foundation resta l'unico owner della geometria finale: gabbia centrata, max-width canonico, safe-area, touch target e spazi condivisi. Non viene creato un secondo design system e non si riscrivono le funzioni pagina per pagina.

Matrice RandUI: **320 / 375 / 390 / 430 / 768 / 1024 / 1440 px**, Chromium + WebKit. Form/auth usano reading width; pagine operative/planning mantengono ritmo compatto; dashboard usa ritmo comfortable; pagine wide restano bounded dal content max.

Navigazione mobile: **Operatività · Planning · Home · Task · RandAI** per i ruoli autorizzati; se Task non è consentito lo slot degrada a una destinazione operativa autorizzata. La bottom bar naviga soltanto. Il `+` crea solo l'oggetto del contesto: Interventi → Nuovo intervento; Planning lavori → Nuovo lavoro; Planning sale → Nuova attività sala.

### Test grafici
Le modifiche visuali RandUI si validano **esclusivamente su DigitalOcean/Ocean** prima della promozione. Il workflow DigitalOcean di produzione fa checkout di `main`, quindi non va usato come finto preview branch. Vercel non è ambiente di esperimento grafico.

## Confini architetturali
- `hotel_id`, membership e scope hotel obbligatori; Supabase RLS/RPC autorità finale.
- RandAI riceve solo contesto autorizzato e hotel-scoped; niente secret/PIN/service_role al frontend o modello.
- Mutazioni protette via Safe Write / Action Gateway / audit.
- Niente secondi sistemi per navigazione, autorizzazione, memoria, scheduler, logging, health, inventario, discovery o rollback.
- Zombie eliminati solo dopo verifica di riferimenti e dipendenze.

## RandRadar
Repo Radar deriva il perimetro dalle 24 pagine, dai moduli Rand e dai fronti evolutivi RandAI. Discovery: GitHub, GitLab, Codeberg e npm. Nessuna discovery auto-installa codice; adozione richiede licenza, manutenzione, sicurezza, compatibilità, benchmark e rollback. Comando: `npm run repo:radar`.

## RandAI Groups 1–3
- Group 1: RandTool Gateway, Promptfoo CI, OpenTelemetry/Phoenix adapter, ToolHive opzionale.
- Group 2: Supabase source of truth, RandMind canonico, Graphiti/LightRAG proiezioni opzionali governate.
- Group 3: RandDurableRuntime con idempotenza, checkpoint/resume/cancel, reautorizzazione e Trigger.dev opzionale server-side.

## Offline
Service Worker + sessione locale controllata + Dexie/IndexedDB sono l'unico stack offline. Ultimo accesso validato riutilizzabile offline fino a 24 ore; preload permission-aware. Rifornimenti/Magazzino non accodano mutazioni generiche senza idempotenza server.

## Stato roadmap RandUI
- Punto 1: navigazione/CTA corrette e coperte da test.
- **Punto 2: Unified Page v2 — gabbia, max-width, ritmo e responsive centralizzati e coperti da contratto.**
- Restano: audit visuale mirato delle pagine deboli; rifacimento mirato (Sensori in priorità); validazione finale Ocean.
