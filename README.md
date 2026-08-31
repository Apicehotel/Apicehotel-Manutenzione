# Apicehotel Manutenzione — RandApp

RandApp è la web/PWA multi-hotel per segnalazioni, manutenzioni, planning, housekeeping e assistenza operativa RandAI.

## Architettura di deployment

- **Vercel**: produzione ufficiale.
- **DigitalOcean**: staging/test.
- **Supabase**: database, autenticazione, Edge Functions e backend RandAI.
- **GitHub `main`**: linea di codice di produzione distribuita su Vercel.

Le strutture condividono le stesse capacità applicative mantenendo dati e configurazioni indipendenti.

## Sicurezza — Consolidamento 3

Il contratto di autenticazione è intenzionalmente distinto:

- PIN utente normale: **4 cifre**;
- PIN amministratore: **6 cifre**.

La directory pre-login espone soltanto i campi minimi necessari alla selezione dell'utente. La directory operativa completa è disponibile soltanto dopo autenticazione valida e membership attiva per la struttura richiesta.

Le sessioni offline hanno una finestra massima di validità di 24 ore dall'ultima validazione. Le operazioni sensibili richiedono rete e falliscono con `ONLINE_REQUIRED` quando il dispositivo è offline. Le normali operazioni progettate per la coda di sincronizzazione continuano invece a funzionare offline.

Il recupero PIN:

- risolve l'email lato server;
- non rivela se un account/email esiste;
- accetta l'email salvata nel profilo anche quando `email_verified=false`;
- usa token casuali memorizzati solo come hash SHA-256;
- scade dopo 15 minuti ed è monouso;
- applica rate limiting;
- esclude gli account di sistema protetti;
- salva il nuovo PIN con bcrypt e azzera lockout/tentativi falliti.

Il trasporto email del recupero usa `pin-recovery` e richiede un provider realmente configurato. Per il sender Resend servono i secret Edge Function `RESEND_API_KEY`, `PIN_RECOVERY_FROM_EMAIL` e facoltativamente `PIN_RECOVERY_APP_URL` (default produzione Vercel). L'integrazione deve risultare abilitata in `integration_settings` e la funzione continua a dichiararsi non disponibile se sender o secret mancano.

## Prestazioni e caricamento — Consolidamento 4

Il bootstrap frontend è organizzato per caricare immediatamente solo ciò che serve alla route corrente e alla prima interazione, senza rinunciare a PWA, sicurezza e recovery.

Contratto di caricamento:

- `src/main.jsx` non importa più staticamente RandApp, RandAI Assistant, portale tecnico, vista segnalazione pubblica o short-link ntfy: ogni route ha un proprio boundary `React.lazy`;
- RandAI Assistant viene richiesto soltanto quando esiste una sessione RandApp locale e segue gli eventi `apice-session-changed` per login/logout;
- **la registrazione PWA/Service Worker resta immediata nel bootstrap** sulle route RandApp compatibili, perché installabilità e disponibilità offline sono un contratto di avvio e non un servizio autenticato;
- diagnostica e telemetria restano differite dopo il caricamento pagina, con fallback compatibile quando `requestIdleCallback` non è disponibile;
- push repair, onboarding notifiche, presenza e ownership degli urgenti non entrano nel bootstrap anonimo: i moduli vengono importati solo dopo una sessione valida e una sola volta per runtime;
- il repair push viene rieseguito quando cambia la struttura della sessione, senza reinizializzare gli altri servizi;
- deployment recovery, dimensionamento UI e tema restano immediati perché proteggono avvio e coerenza visiva;
- `xlsx` resta separato dal percorso JavaScript iniziale e viene caricato soltanto dal flusso di import che lo richiede;
- i CSS globali del design system restano nell'entry per evitare flash di stile e variazioni di cascade tra iOS, Android e Windows: l'ottimizzazione del Punto 4 riguarda i confini JavaScript misurati, non spostamenti CSS ad alto rischio;
- `scripts/check-bundle.mjs` impone un budget CI di **400 KiB** sul percorso JavaScript statico iniziale;
- i test di `test/performance-loading-boundaries.test.js` impediscono regressioni dei confini lazy/deferred e proteggono esplicitamente la registrazione PWA immediata.

La build Point 4 prima del ripristino PWA misurava **311,5 KiB in 2 chunk statici**. Il valore finale viene accettato solo dalla CI del commit definitivo e deve restare sotto il budget di 400 KiB; non viene quindi presentato il valore intermedio come misura finale.

Le prestazioni vengono accettate solo insieme ai gate di build, bundle budget, suite completa, Chromium/WebKit e device acceptance su profili iOS, Android e Windows.

## Avvio locale

```bash
npm ci
npm run dev
```

Comandi di qualità:

```bash
npm run build
npm run test:matrix
```
