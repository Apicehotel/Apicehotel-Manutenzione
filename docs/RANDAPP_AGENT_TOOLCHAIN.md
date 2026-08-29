# RandApp Agent Toolchain

Branch di preparazione: `chore/randapp-agent-toolchain`.

Questa toolchain non modifica la logica applicativa. Serve a guidare audit, test, sicurezza e certificazione dal punto 19 in avanti, dopo il freeze funzionale del punto 18.

## Regola di completamento

Un punto non e completato quando il codice e scritto. E completato solo quando build, test pertinenti e controlli di regressione passano.

## Skill core verificate

### Backend / database
- `supabase/postgres-best-practices` — schema, query, indici, migrazioni, RLS e isolamento tenant/hotel.

### Security
- `openai/security-threat-model` — threat model repository-specific e trust boundaries.
- `openai/security-best-practices` — revisione vulnerabilita applicative.
- `trailofbits/audit-context-building` — comprensione architetturale profonda prima dell'audit.
- `trailofbits/differential-review` — review di sicurezza delle modifiche e del diff.
- `trailofbits/insecure-defaults` — default insicuri, credenziali, fail-open.
- `trailofbits/sharp-edges` — API e configurazioni facili da usare in modo insicuro.
- `trailofbits/static-analysis` — analisi statica con strumenti dedicati.

### Browser / qualita
- `openai/playwright` — browser automation ed E2E reali.
- `addyosmani/web-quality-audit` — audit web complessivo.
- `addyosmani/core-web-vitals` — performance e metriche UX.
- `addyosmani/accessibility` — accessibilita.

### CI / deploy
- `openai/gh-fix-ci` — diagnosi delle GitHub Actions fallite.
- `openai/vercel-deploy` — supporto al deploy Vercel.

## Skill opzionali dopo il punto 22
- `testmu-ai/appium-skill` — test Android/iOS nativi o device-level quando Playwright non basta.
- `testmu-ai/smartui-skill` — visual regression avanzata.
- `garrytan/canary` — controllo post-deploy.

## Esclusioni deliberate
Non installare skill duplicate per Cypress, Selenium, Next.js, React Native, Flutter, Firebase, Auth0, Better Auth, Neon o altri stack non usati da RandApp.

Sentry non richiede una nuova dipendenza: `@sentry/react` e gia presente nel progetto. Playwright e gia presente nel progetto. La skill guida l'uso, non duplica il runtime.

## Roadmap 19-29

19. Dependency & Code Quality Audit
20. Supabase & RLS Audit
21. Auth, Ruoli & Threat Model
22. E2E + Visual Regression
23. Offline & Chaos Testing
24. File & Photo Hardening
25. Multi-Hotel Isolation Certification
26. Performance, Accessibility & PWA
27. CI Quality Gate
28. Deploy & Production Canary
29. Baseline certificata RandApp 1.0

## Quality gates specifici RandApp
- Hotel: `hotelgio`, `chocohotel`, `brigantino`.
- Piattaforme: `ios-webkit`, `android-chromium`, `windows-chromium`.
- Rete: `online`, `offline`, `reconnect`.
- Isolamento: un utente/hotel non deve leggere, scrivere o ricevere notifiche degli altri hotel.
- Permessi: controlli frontend e RLS devono fallire chiusi.
- Offline: nessuna perdita dati o duplicazione dopo retry/reconnect.
- Housekeeping: import idempotente e separato per hotel.
- Foto: tipo reale, dimensioni, staging offline e Storage.
- Produzione: deploy verde non basta; serve smoke/canary sui flussi critici.

## Fonti
Catalogo: https://github.com/VoltAgent/awesome-agent-skills
OpenAI: https://github.com/openai/skills
Supabase: https://github.com/supabase/agent-skills

Le skill esterne vanno installate solo da fonte ufficiale e dopo verifica del loro `SKILL.md`, script e dipendenze. Non usare un `install all`.