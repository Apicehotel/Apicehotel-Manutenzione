# TASKS: 000-randspec-v1

- [DONE] T001 Definire Rand Constitution v1 — Evidence: `docs/governance/RAND_CONSTITUTION.md`
- [DONE] T002 Definire template SPEC/PLAN/TASKS/CHANGE — Evidence: `specs/_template/`
- [DONE] T003 Documentare integrazione RandSpec/RandFlow/RandRadar — Evidence: `docs/architecture/RANDSPEC_V1.md`
- [DONE] T004 Aggiungere validatore fail-closed — Evidence: `scripts/validate-randspec.mjs`
- [DONE] T005 Aggiungere test governance — Evidence: `test/randspec-governance.test.js`
- [DONE] T006 Collegare validazione a package/CI — Evidence: `package.json`, `.github/workflows/ci.yml`
- [DONE] T007 Aggiornare PR template e README — Evidence: `.github/PULL_REQUEST_TEMPLATE.md`, `README.md`

## Converge checklist
- [DONE] C001 Acceptance criteria confrontati con implementazione — Evidence: `test/randspec-governance.test.js`
- [DONE] C002 Test/security/CI pertinenti verdi — Evidence: CI della PR (gate finale prima del merge)
- [DONE] C003 README/docs aggiornati — Evidence: `README.md`, `docs/architecture/RANDSPEC_V1.md`
- [DONE] C004 Zero unresolved critici nel perimetro — Evidence: review PR; branch protection amministrativa è requisito repo-level documentato, non implementabile da questo change-set
