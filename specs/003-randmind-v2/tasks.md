# TASKS: 003-randmind-v2

- [DONE] T001 Inventariare RandMind LIVE e definire delta v2. Evidence: `specs/003-randmind-v2/plan.md`
- [DONE] T002 Implementare verified audit ingestion. Evidence: `src/randai/memory/evidence.js`, `src/randai/memory/randmind.js`
- [DONE] T003 Implementare temporal recall/superseded timestamp. Evidence: `src/randai/memory/engine.js`, `supabase/migrations/20260912130000_randmind_v2.sql`
- [DONE] T004 Implementare conflict resolution governata. Evidence: `src/randai/memory/store.js`, migration v2
- [DONE] T005 Implementare retention planner non distruttivo. Evidence: `src/randai/memory/evidence.js`
- [DONE] T006 Integrare API RandMind/store canonici. Evidence: `src/randai/memory/randmind.js`, `src/randai/memory/store.js`
- [DONE] T007 Aggiungere Group 5 + regressione Group 4. Evidence: `test/randai-group5-randmind-v2.test.js`, `.github/workflows/randai-group5-randmind-v2.yml`, `package.json`
- [DONE] T008 Aggiornare README/architecture/ecosystem. Evidence: `README.md`, `docs/architecture/RANDMIND_V2.md`, `src/randai/core/ecosystem.js`
- [DONE] T009 Zombie/overlap check. Evidence: `specs/003-randmind-v2/plan.md`, `docs/architecture/RANDMIND_V2.md`
- [DOING] T010 CI completa verde. Evidence: PR Point 4
- [TODO] T011 Converge ready-for-human-review senza merge. Evidence: PR Point 4
