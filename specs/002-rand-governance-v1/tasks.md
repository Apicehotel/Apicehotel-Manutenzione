# TASKS: 002-rand-governance-v1

- [DONE] T001 Inventariare owner esistenti e bloccare duplicazioni. Evidence: `specs/002-rand-governance-v1/plan.md`, `docs/architecture/RAND_GOVERNANCE_V1.md`
- [DONE] T002 Implementare RandRules dichiarativo fail-closed. Evidence: `src/randai/core/governance-runtime.js`, `test/randai-group4-governance.test.js`
- [DONE] T003 Implementare RandSecure come restrittore sopra boundary esistenti. Evidence: `src/randai/core/governance-runtime.js`, `src/randai/action-gateway.js`
- [DONE] T004 Implementare RandAudit append-only con redazione secrets. Evidence: `src/randai/core/governance-runtime.js`, `supabase/migrations/20260912122000_rand_governance_v1.sql`
- [DONE] T005 Implementare RandDoctor come compositore health/evidence. Evidence: `src/randai/core/governance-runtime.js`, `src/randai/core/health-snapshot.js`
- [DONE] T006 Aggiungere persistence Supabase per rules/audit. Evidence: `src/randai/core/supabase-governance-store.js`, `supabase/migrations/20260912122000_rand_governance_v1.sql`
- [DONE] T007 Aggiungere test Group 4 e workflow PR-stacked. Evidence: `test/randai-group4-governance.test.js`, `.github/workflows/randai-group4-governance.yml`
- [DONE] T008 Integrare export/package/ecosystem senza creare owner paralleli. Evidence: `src/randai/core/index.js`, `src/randai/core/ecosystem.js`, `package.json`
- [DONE] T009 Aggiornare README e architettura. Evidence: `README.md`, `docs/architecture/RAND_GOVERNANCE_V1.md`
- [DONE] T010 Zombie/overlap check finale. Evidence: `specs/002-rand-governance-v1/plan.md`, `docs/architecture/RAND_GOVERNANCE_V1.md`
- [DONE] T011 Ottenere CI completa verde. Evidence: GitHub Actions PR #239, commit `08bf51ee2d5b518250fd3623af446d19e905176a`
- [DONE] T012 Preparare Converge per revisione umana, senza merge automatico. Evidence: PR #239, closure commit sottoposto nuovamente ai gate prima della transizione ready-for-review
