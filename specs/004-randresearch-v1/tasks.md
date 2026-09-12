# TASKS: 004-randresearch-v1

- [DONE] T001 Inventariare owner esistenti e RandRadar. Evidence: `specs/004-randresearch-v1/plan.md`
- [DONE] T002 Implementare core L0-L4/query/budget. Evidence: `src/randai/research/runtime.js`
- [DONE] T003 Implementare provenance/source scoring/contradictions/gap/ship gate. Evidence: `src/randai/research/runtime.js`
- [DONE] T004 Implementare coordinator fail-closed. Evidence: `src/randai/research/coordinator.js`
- [DONE] T005 Implementare persistence Supabase. Evidence: `src/randai/research/store.js`, `supabase/migrations/20260912143000_randresearch_v1.sql`
- [DONE] T006 Aggiungere Group 6 e regressioni Point 4/3. Evidence: `test/randai-group6-randresearch.test.js`, `.github/workflows/randai-group6-randresearch.yml`
- [DONE] T007 Integrare package/README/architecture/ecosystem. Evidence: `package.json`, `README.md`, `docs/architecture/RANDRESEARCH_V1.md`, `src/randai/core/ecosystem.js`
- [DONE] T008 Zombie/overlap check finale. Evidence: `specs/004-randresearch-v1/plan.md`; nessun retrieval/memory/durable/audit owner duplicato.
- [DONE] T009 CI completa verde. Evidence: PR #241, commit `64c2e7d8aa9f864eab728000bffd5e9b79e19a9a`; CI + Group 1/3/4/5/6 tutti `success`.
- [DONE] T010 Converge ready-for-human-review. Evidence: PR #241; stato RandSpec `READY_FOR_HUMAN_REVIEW`, merge/deploy esclusivamente umani.
