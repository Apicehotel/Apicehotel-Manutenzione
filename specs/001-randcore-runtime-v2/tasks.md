# TASKS: 001-randcore-runtime-v2

- [DONE] T001 Inventariare runtime/durable/scheduler/health esistenti senza duplicare owner. Evidence: `docs/architecture/RANDCORE_RUNTIME_V2.md`
- [DONE] T002 Implementare event envelope HOTEL/SYSTEM con correlation e causation. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T003 Implementare publish fan-out e job lifecycle fail-closed. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T004 Implementare retry bounded e dead-letter. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T005 Implementare worker registry, heartbeat e stale detection. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T006 Integrare start/resume con RandDurableRuntime senza riscriverlo. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T007 Aggiungere snapshot operativo e store contract. Evidence: `src/randai/core/randcore-runtime.js`
- [DONE] T008 Aggiungere test Group 3. Evidence: `test/randai-group3-randcore-runtime.test.js`
- [DONE] T009 Documentare ownership, failure model e connessioni future. Evidence: `docs/architecture/RANDCORE_RUNTIME_V2.md`
- [DONE] T010 Rendere Group 3 eseguibile sulle PR stacked. Evidence: `.github/workflows/randai-group3-durable.yml`
- [DOING] T011 Ottenere CI completa verde sulla PR dedicata. Evidence: GitHub Actions della PR Punto 2
- [TODO] T012 Chiudere Converge con PR pronta a revisione umana, senza merge automatico. Evidence: PR Punto 2
