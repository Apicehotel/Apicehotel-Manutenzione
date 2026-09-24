# TASKS: 012-runtime-zombie-cleanup-v1

- [DONE] T001 Rimuovere preview runtime RandUI v2 isolata — Evidence: src/main.jsx + delete src/randapp/randui-v2/*
- [DONE] T002 Assorbire urgent shell fix — Evidence: src/randapp/adaptive-layout.css
- [DONE] T003 Rimuovere owner tablet duplicato — Evidence: src/randapp/randui/foundation.css
- [DONE] T004 Aggiornare contratto RandUI 96 — Evidence: test/randai-block25-randui-93-97.test.js
- [DONE] T005 Aggiungere gate anti-zombie — Evidence: test/runtime-zombie-cleanup.test.js
- [DONE] T006 Aggiornare README — Evidence: README.md

## Converge checklist
- [DONE] C001 Acceptance criteria confrontati con implementazione — Evidence: test/runtime-zombie-cleanup.test.js
- [TODO] C002 CI pertinente verde — Evidence: PR
- [DONE] C003 README/docs aggiornati — Evidence: README.md + specs/012-runtime-zombie-cleanup-v1
- [DONE] C004 Nessuna migrazione/documentazione utile rimossa — Evidence: scope file list
