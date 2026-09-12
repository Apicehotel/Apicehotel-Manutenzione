# PLAN: 002-rand-governance-v1

## Ownership inventory
- RandCore Runtime: eventi/job/worker/retry/DLQ — riuso, non duplicare.
- Action Gateway + RandTool Gateway + RLS/RPC: authorization/execution boundary — riuso, RandSecure restringe soltanto.
- health-snapshot / health-evidence / full-health-gate: health owner — riuso, RandDoctor compone.
- audit canonico persistente: assente — aggiungere.
- rule engine operativo canonico: assente — aggiungere.

## Design
1. `governance-runtime.js`: RandRules, RandSecure, RandAudit e RandDoctor con contratti puri/testabili.
2. `SupabaseRandGovernanceStore`: adapter produttivo per regole e audit.
3. Migration Postgres: `rand_governance_rules`, `rand_governance_audit`, RLS, privilegi service-role e trigger audit immutabile.
4. Group 4 test/workflow e integrazione exports/package scripts.
5. README + architecture + ecosystem evidence.

## RandRadar decision
Nessuna nuova dipendenza. Pattern già valutati sufficienti: Sonarr (health/history/escalation), DeskcommCRM (rules + append-only audit + DB invariants), CloddsBot (doctor/security/event bus), Spec Kit (governance). Classificazione: ADAPT patterns, non installare runtime esterni.

## Future connections
- Punto 4 RandMind può apprendere solo da audit/esiti verificati.
- Punto 5 RandResearch può essere invocato come remediation per diagnosi incerte.
- Punto 6 HITL userà `REQUIRE_APPROVAL` senza cambiare RandSecure.
- Punto 7 MCP/Gateway/Chat produrrà intent attraverso lo stesso boundary.

## Rollback
Rimuovere gli export/adapter e disabilitare le nuove tabelle; RandCore Runtime, Action Gateway e health esistenti restano indipendenti.
