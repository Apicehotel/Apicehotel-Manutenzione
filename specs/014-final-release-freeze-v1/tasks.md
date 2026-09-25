# TASKS: 014-final-release-freeze-v1

- [DONE] T001 Centralizzare raccolta evidenze release — Evidence: scripts/release-evidence.mjs
- [DONE] T002 Promuovere web readiness in CI — Evidence: Web Release Readiness gate
- [DONE] T003 Implementare freeze policy pura — Evidence: src/release/freeze-policy.js
- [DONE] T004 Generare attestation freeze — Evidence: scripts/check-final-freeze.mjs
- [DONE] T005 Conservare artefatto CI 365 giorni — Evidence: Upload final freeze evidence
- [DONE] T006 Documentare LTS/distribuzione — Evidence: README + docs/governance/RELEASE_FREEZE.md
- [DONE] T007 Test anti-bypass/anti-zombie — Evidence: test/final-freeze-v1.test.js

## Converge checklist
- [DONE] C001 Punto 9 incorporato: web readiness + distribuzione esplicita. Evidence: Web Release Readiness gate + final freeze artifact.
- [DONE] C002 Punto 10 implementato: freeze policy + artifact. Evidence: src/release/freeze-policy.js + scripts/check-final-freeze.mjs.
- [TODO] C003 CI finale verde sul head PR. Evidence: PR #365 checks.
- [DONE] C004 Nessuna nuova dependency/runtime. Evidence: package.json dependencies unchanged; only scripts/governance added.
