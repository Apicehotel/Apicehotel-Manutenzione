# CHANGE LOG: 002-rand-governance-v1

## Changes
- 2026-09-12: inventario completato; RandSecure ridefinito come restrittore e RandDoctor come compositore per non duplicare Action Gateway/RLS/RPC/health.
- 2026-09-12: scelta architettura dependency-free con regole dichiarative; esclusi eval e rule engine esterni.
- 2026-09-12: implementati RandRules, RandSecure, RandAudit, RandDoctor e `RandGovernanceRuntime` canonico; nessun componente esegue direttamente mutazioni operative.
- 2026-09-12: aggiunti `SupabaseRandGovernanceStore`, tabelle `rand_governance_rules`/`rand_governance_audit`, RLS, privilegi service-role e audit immutable trigger.
- 2026-09-12: sostituito il filtro PostgREST dinamico con query SYSTEM/HOTEL separate e `.eq()` per ridurre ambiguità e rischio di interpolazione.
- 2026-09-12: aggiunti test Group 4, workflow dedicato, export core, manifest ecosystem, README e architettura.
- 2026-09-12: primo Group 4 ha confermato i contratti governance verdi; il solo errore era formale RandSpec, corretto allineando headings ed Evidence al validator canonico.
- 2026-09-12: sul commit `08bf51ee2d5b518250fd3623af446d19e905176a` sono verdi Group 4 Governance, Group 1 Security, Group 3 Durable Runtime e CI generale incluse browser/device, RandCore Health ed LTS.
- 2026-09-12: avviato closure commit documentale `READY_FOR_HUMAN_REVIEW`; nessun merge o deploy automatico.
