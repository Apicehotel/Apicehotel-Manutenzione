# TASKS — randui-standardization-v1

- [DONE] T001 Add portable RandUI token contract. Evidence: `src/randapp/randui/design-tokens.json`.
- [DONE] T002 Add centralized motion contract with reduced-motion fail-safe. Evidence: `src/randapp/randui/motion-contract.js`.
- [DONE] T003 Add semantic icon adapter policy without replacing the runtime owner. Evidence: `src/randapp/randui/icon-contract.js`.
- [DONE] T004 Bind new standards into the existing RandUI v1 design contract without changing `RANDUI_VERSION`. Evidence: `src/randapp/randui/design-contract.js`.
- [DONE] T005 Add anti-regression tests and zombie guard. Evidence: `test/randui-standardization-v1.test.js`.
- [DONE] T006 Document ownership, external-tool boundaries and migration policy. Evidence: `docs/architecture/RANDUI_STANDARDIZATION_V1.md`.
- [DONE] T007 Validate complete CI/Ocean/browser/device gates on the stacked consolidation branch. Evidence: PR #323 checks on `cursor/close-non-wa-gaps-1e9a` (`build-test-e2e`, Ocean Deploy + Browser visual gate, guardrails) green at `a0de99c3`.
