# PLAN: 002-rand-governance-v1

## Canonical owners
- RandCore Runtime: eventi/job/worker/retry/DLQ — riuso, non duplicare.
- Action Gateway + RandTool Gateway + RLS/RPC: authorization/execution boundary — riuso; RandSecure restringe soltanto.
- `health-snapshot`, `health-evidence`, `full-health-gate`: health owner — riuso; RandDoctor compone.
- Audit decisionale persistente: non esisteva un owner canonico — aggiunto RandAudit.
- Rule engine operativo canonico: non esisteva — aggiunto RandRules.

## Current state
Il Punto 2 ha reso durevole RandCore, ma le decisioni operative non avevano un contratto unico per rule matching, risk gating, provenance e diagnosis. Security e health avevano già owner reali e non dovevano essere riscritti.

## Proposed change
1. `governance-runtime.js`: RandRules, RandSecure, RandAudit, RandDoctor e `RandGovernanceRuntime` con contratti puri/testabili.
2. `SupabaseRandGovernanceStore`: adapter produttivo per regole e audit.
3. Migration Postgres: `rand_governance_rules`, `rand_governance_audit`, RLS, privilegi service-role e trigger audit immutabile.
4. Group 4 test/workflow e integrazione exports/package scripts.
5. README + architecture + ecosystem evidence.
6. Nessuna esecuzione diretta: gli intent idonei proseguono verso RandCore/Action Gateway.

## RandRadar decision
Nessuna nuova dipendenza. Pattern già valutati sufficienti: Sonarr (health/history/escalation), DeskcommCRM (rules + append-only audit + DB invariants), CloddsBot (doctor/security/event bus), Spec Kit (governance). Classificazione: **ADAPT** dei pattern, non installare runtime esterni.

## Rollback
Rimuovere gli export/adapter e disabilitare le nuove tabelle; RandCore Runtime, Action Gateway e health esistenti restano indipendenti. La migration non altera tabelle operative preesistenti.

## Tests and evidence
- `test/randai-group4-governance.test.js`: rule matching, hotel isolation, risk/approval, redazione secrets, pipeline, doctor e DB contract.
- `.github/workflows/randai-group4-governance.yml`: Group 4 su ogni PR, incluse stacked PR.
- CI generale continua a coprire build, multi-hotel, browser/device, RandCore health e LTS.

## Zombie check
Nessun owner esistente è zombie: logger/telemetry sono observability, non audit decisionale; health resta owner dei check; Action Gateway resta owner dell'esecuzione; RandSecure e RandDoctor sono adapter/compositori e non sistemi paralleli.

## Future connections
- Punto 4 RandMind può apprendere solo da audit/esiti verificati.
- Punto 5 RandResearch può essere invocato come remediation per diagnosi incerte.
- Punto 6 HITL userà `REQUIRE_APPROVAL` senza cambiare RandSecure.
- Punto 7 MCP/Gateway/Chat produrrà intent attraverso lo stesso boundary.
