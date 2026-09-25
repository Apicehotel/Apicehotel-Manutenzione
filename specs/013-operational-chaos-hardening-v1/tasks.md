# TASKS: 013-operational-chaos-hardening-v1

- [DONE] T001 Creare Operational Action Guard — Evidence: src/randapp/operational-action-guard.js
- [DONE] T002 Migrare Segnalazioni — Evidence: src/randapp/Issues.jsx
- [DONE] T003 Migrare Interventi — Evidence: src/randapp/operations/InterventionsView.jsx
- [DONE] T004 Migrare Task/Rifornimenti — Evidence: TaskResourceDetail.jsx, SupplyRequestDetail.jsx
- [DONE] T005 Propagare failure Reminder/Supply — Evidence: RemindersView.jsx, SupplyRequestsPortal.jsx
- [DONE] T006 Chaos contract + CI step — Evidence: test/operational-chaos-gate.test.js, .github/workflows/ci.yml
- [DONE] T007 README/RandSpec — Evidence: README.md + specs/013-operational-chaos-hardening-v1

## Converge checklist
- [DONE] C001 Acceptance criteria confrontati con implementazione — Evidence: test/operational-chaos-gate.test.js
- [TODO] C002 CI pertinente verde — Evidence: PR
- [DONE] C003 README/docs aggiornati — Evidence: README.md
- [DONE] C004 Offline/device coverage riusata senza duplicazioni — Evidence: existing gates referenced by chaos contract
