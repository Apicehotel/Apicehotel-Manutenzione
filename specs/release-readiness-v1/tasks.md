# TASKS: release-readiness-v1

- [DONE] T001 Restore a pure release-readiness evaluator. Evidence: `src/release/release-readiness.js`.
- [DONE] T002 Separate web and Android evidence requirements. Evidence: Android requires `signedPackage` + `realDevice`.
- [DONE] T003 Wire repository release check commands. Evidence: `release:check` and `release:check:android` in package scripts.
- [DONE] T004 Add deterministic regression tests. Evidence: `test/release-readiness-v1.test.js`.
- [DONE] T005 Reuse existing device acceptance instead of creating a second suite. Evidence: `test/device-acceptance.mjs` + `docs/DEVICE_ACCEPTANCE.md`.
- [DONE] T006 Preserve human merge/release authority and external signing secrets. Evidence: spec/plan + RandFlow freeze.

- [DONE] T007 Promote web release readiness to canonical CI gate. Evidence: `.github/workflows/ci.yml` → Web Release Readiness gate.
- [DONE] T008 Keep Android native fail-closed and report it separately from web freeze. Evidence: `release:check:android` + final freeze artifact.
