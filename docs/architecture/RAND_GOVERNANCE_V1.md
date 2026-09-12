# Rand Governance v1 — Rules, Audit, Doctor, Secure

## Scopo
Il Punto 3 completa il control plane sopra RandCore Runtime v2 senza creare autorità parallele. RandRules decide quali intent proporre; RandSecure li restringe; RandAudit conserva evidence append-only; RandDoctor diagnostica usando health/evidence già canonici.

## Pipeline canonica
`RandCore event → RandRules → action intent → RandSecure → RandAudit → RandCore / Action Gateway`

RandRules, RandSecure e RandDoctor **non eseguono direttamente mutazioni operative**. Action Gateway, RandTool Gateway, RLS/RPC e i normali permission check restano il boundary finale.

## RandRules
Regole dichiarative e versionate. Supporta composizione `all`, `any`, `not` e operatori `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `exists`. Non accetta funzioni, `eval`, script o codice scaricato. Ogni regola ha scope HOTEL/SYSTEM, event type, priorità e un intent tipizzato con risk/scopes.

La persistence produttiva vive in `rand_governance_rules`; l'engine resta puro e deterministico per poter rieseguire una decisione durante audit/debug.

## RandSecure
RandSecure è un **restrittore**, non un authorization server. Verifica:
- validità intent;
- allowlist action type;
- coerenza hotel;
- required scopes;
- permission già concessa dal boundary canonico;
- rischio e approvazione.

LOW può risultare `ELIGIBLE`; MEDIUM/HIGH richiedono approvazione; CRITICAL richiede anche `critical:execute`. `ELIGIBLE` significa soltanto “può raggiungere il gateway”, non “azione autorizzata/eseguita”.

## RandAudit
`rand_governance_audit` è append-only. Update/delete sono bloccati da trigger DB; ai client anon/authenticated sono revocati i privilegi. L'adapter produttivo usa service role server-side. I dettagli vengono redatti ricorsivamente per chiavi sensibili (token, password, secret, authorization, cookie, service role, API key, PIN).

Ogni record può collegare actor/event/job/intent/correlation e reason codes. Questo diventa la provenance operativa che RandMind potrà consumare soltanto quando l'esito è verificato.

## RandDoctor
RandDoctor non ricalcola un secondo health score. Legge snapshot RandCore e health checks già prodotti, e genera findings con severity/codice/evidence: worker stale, dead-letter, backlog e health UNKNOWN/DEGRADED/CRITICAL. Le remediation sono intent governati, non side-effect diretti.

## Database/security
Migration: `supabase/migrations/20260912122000_rand_governance_v1.sql`.
- RLS abilitata su rules/audit;
- nessuna policy client;
- `anon`/`authenticated` revocati;
- rules gestibili soltanto server-side service role;
- audit service role: SELECT/INSERT soltanto;
- audit immutable trigger per UPDATE/DELETE.

## Connessioni future
- RandMind 2.0: apprendimento da audit con outcome verificati e provenance.
- RandResearch: escalation di finding incerti senza trasformare ricerca in executor.
- HITL/Sandbox: materializza gli approval richiesti da RandSecure.
- MCP/Gateway/Chat: nuovi ingressi producono intent, non bypassano RandSecure/Action Gateway.

## Zombie/overlap policy
Non vengono introdotti `Security2`, `Health2`, `Scheduler2` o `Audit logger` paralleli. Logger e telemetry restano osservabilità; RandAudit è evidence decisionale persistente. Health esistente resta owner dei check; Doctor aggrega e spiega.
