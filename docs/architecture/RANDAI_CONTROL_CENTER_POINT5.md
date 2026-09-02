# RandAI Control Center — Punto 5

## Obiettivo

Il Punto 5 trasforma Worker e Log da placeholder a centro controllo verificabile senza introdurre una seconda fonte di verità.

## Fonti

- Worker: `cron.job` e `cron.job_run_details`.
- Regole: `randai_action_gateway_settings` e `randai_autonomy_policies`.
- Audit: `operational_audit_log` e `randai_action_audit`.
- Anomalie: run cron falliti, WhatsApp `error/needs_info`, knowledge gap aperti, azioni RandAI fallite/negate/rifiutate.
- Osservabilità: `randai_observability_traces`, `randai_eval_runs`, `randai_supervisor_runs`.

## Sicurezza

`randai_control_snapshot` è `SECURITY DEFINER` ma richiede `auth.uid()`, membership attiva e `can_access_admin=true`. Se viene richiesto un hotel non compreso nelle membership, la RPC fallisce con `hotel_scope_denied`.

Il browser non legge direttamente gli schemi `cron` e non riceve comandi SQL. Il retry è server-side e allowlistato esclusivamente per:

- `weather-alert-worker-2h-daytime`;
- `sync-sensori-temperatura-secure`.

La RPC recupera il comando già configurato in `pg_cron`, lo invia e registra l'operazione in `operational_audit_log` e `randai_worker_runs`.

## Costi

Il costo non viene stimato. La UI mostra USD soltanto quando `randai_observability_traces.trace.cost_usd` contiene un valore registrato dal provider. Altrimenti mostra `Non disponibile`. Lo stesso principio vale per input/output token mancanti.

## Schedule

La UI calcola la prossima esecuzione solo per forme cron deterministiche supportate dal parser (`*`, `*/N`, numeri e liste nei campi minuto/ora con giorno/mese/giorno-settimana wildcard). Se uno schedule futuro non è supportato, mostra `non calcolabile` anziché inventare un orario.

## UI

`SystemControlConsole` è riusato con cinque modalità: `workers`, `audit`, `rules`, `anomalies`, `observability`. In questo modo Worker, Log e i moduli di sistema condividono la stessa snapshot e lo stesso contratto di sicurezza.

## Test

`test/randai-control-center-point5.test.js` copre wiring, scope, sorgenti reali, allowlist retry, parser cron e comportamento evidence-only dei costi.
