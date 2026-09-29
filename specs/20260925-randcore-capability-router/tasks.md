# Tasks

- [DONE] T001 Add capability registry/router. Evidence: `src/randai/core/capability-router.js`.
- [DONE] T002 Add removable provider registration and deterministic priority/preflight. Evidence: router register/unregister/listProviders tests.
- [DONE] T003 Enforce fail-closed and safe fallback policy. Evidence: `test/randcore-capability-router.test.js`.
- [DONE] T004 Add minimal capability trace and provider health snapshot. Evidence: router invoke/healthSnapshot contracts.
- [DONE] T005 Add RandGateway provider for `operational.action`. Evidence: `src/randai/core/capability-providers.js`.
- [DONE] T006 Add canonical runtime registration. Evidence: `src/randai/core/capability-runtime.js`.
- [DONE] T007 Route Action Gateway through capability runtime without changing RLS/HITL authority. Evidence: `src/randai/action-gateway.js`.
- [DONE] T008 Export capability primitives from RandCore. Evidence: `src/randai/core/index.js`.
- [DONE] T009 Add dedicated unit-test command. Evidence: `npm run test:capabilities`.
- [DONE] T010 Update README and architecture documentation. Evidence: `README.md` and `docs/architecture/RANDCORE_CAPABILITY_ROUTER_V1.md`.
- [DOING] T011 Pass repository CI gates. Evidence: PR #367 GitHub Actions.
- [TODO] T012 Human review and merge. Evidence: PR #367 remains unmerged until human approval.
