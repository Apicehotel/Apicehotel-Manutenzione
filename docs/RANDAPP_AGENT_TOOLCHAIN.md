# RandApp Agent Toolchain

Branch di preparazione: `chore/randapp-agent-toolchain`.

Questa toolchain non modifica la logica applicativa. Serve a guidare audit, test, sicurezza e certificazione dal punto 19 in avanti, dopo il freeze funzionale del punto 18.

## Regola di completamento

Un punto non e completato quando il codice e scritto. E completato solo quando build, test pertinenti e controlli di regressione passano.

## Skill core installate/verificate

### Backend / database
- `supabase-postgres-best-practices` — schema, query, indici, migrazioni, RLS e isolamento tenant/hotel.

### Security
- `security-threat-model` — threat model repository-specific e trust boundaries.
- `security-best-practices` — revisione vulnerabilita applicative.
- `audit-context-building` — comprensione architetturale profonda prima dell'audit.
- `differential-review` — review di sicurezza delle modifiche e del diff.
- `sharp-edges` — API e configurazioni facili da usare in modo insicuro.
- `semgrep` — analisi statica pattern-based e security scanning.
- `codeql` — analisi semantica/security query-driven.

Nota: `insecure-defaults` e `static-analysis` sono oggi plugin Trail of Bits, non singole skill Codex installabili dal catalogo root. La toolchain usa quindi le skill installabili reali `semgrep` e `codeql`; la copertura dei default insicuri resta affidata a `security-best-practices` + `sharp-edges`.

### Browser / qualita
- `playwright` — browser automation ed E2E reali.
- `web-quality-audit` — audit web complessivo.
- `core-web-vitals` — performance e metriche UX.
- `accessibility` — accessibilita.

### CI / deploy
- `gh-fix-ci` — diagnosi delle GitHub Actions fallite.
- `openai/vercel-deploy` resta opzionale per il punto 28.

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

## Installazione riproducibile

Il sandbox locale puo avere DNS limitato. Per questo il branch contiene un workflow GitHub dedicato che usa la rete dei runner GitHub per eseguire l'installer Codex, validare tutte le skill core e vendorizzare il risultato in `.agents/skills`. Il gate fallisce se una skill dichiarata core non e realmente presente.

Installazione verificata su GitHub Actions il 29 agosto 2026: tutte le 13 skill core sono state copiate per Codex e il gate `test:agent-toolchain` e passato. Il commit di vendoring risultante e `decca416e3b6b94c3ac73078e501590abb35c68a`.

## Fonti
Catalogo: https://github.com/VoltAgent/awesome-agent-skills
OpenAI: https://github.com/openai/skills
Supabase: https://github.com/supabase/agent-skills
Trail of Bits: https://github.com/trailofbits/skills
Web Quality: https://github.com/addyosmani/web-quality-skills

Le skill esterne vanno installate solo da fonte approvata e dopo verifica del loro `SKILL.md`, script e dipendenze. Non usare un `install all`.
