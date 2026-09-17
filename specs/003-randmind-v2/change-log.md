# CHANGE LOG: 003-randmind-v2

## Changes
- 2026-09-12: inventario RandMind LIVE; deciso delta v2 senza Memory2 o nuove dipendenze.
- 2026-09-12: definito trust boundary: solo ACTION_OUTCOME SUCCEEDED + OUTCOME_VERIFIED alimenta memoria verificata.
- 2026-09-12: aggiunti recall as-of, superseded_at, conflict resolution governata, retention planner non distruttivo e provenance audit→memory.
- 2026-09-12: corretto il contratto legacy: task SUCCEEDED produce memoria SUGGESTED, non VERIFIED, fino a evidenza esplicita.
- 2026-09-12: commit funzionale `8514ae9af2b6fa24a83e01bedb9d2cfab2d116d8` verde su Group 1 Security, Group 3 Durable Runtime, Group 4 Governance, Group 5 RandMind v2 e CI completa inclusi browser/device, RandCore health ed LTS.
- 2026-09-12: converge avviato per PR #240 stacked, senza merge automatico né push/deploy su main.
