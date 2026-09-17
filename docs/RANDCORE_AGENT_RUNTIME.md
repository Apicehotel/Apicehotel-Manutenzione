# RandCore Agent Runtime

The canonical Rand agents are persisted in `public.randcore_agent_runtime`.

## Truth model

- `heartbeat_at` is the liveness source. The UI derives `OFFLINE` when no heartbeat is present or it is older than five minutes.
- `status` is the agent-reported execution state: `RUNNING`, `WAITING_APPROVAL`, `ERROR`, `IDLE`, `OFFLINE`.
- `desired_state` is operator intent: `RUNNING` or `PAUSED`.
- `task_id`, `activity`, `detail` and `hotel_id` describe current work without granting authorization.
- No UI may mark an agent online without a recent heartbeat.

## Control rule

Workers and future agent runners must read `desired_state` before accepting a new task. `PAUSED` blocks starting new work but must not interrupt a critical operation mid-transaction. Production-changing actions remain subject to existing RandSecure/HITL/Action Gateway rules and the repository freeze: agents never push or deploy directly to `main`.

## Heartbeat write rule

Heartbeat/status writes belong to trusted server-side workers using service-role access. Browser clients may read the board and authenticated admins may change `desired_state` through RLS; they do not own heartbeat/status truth.

## UI

`/randai` exposes **Agenti IA** in the primary Control Center navigation. The page subscribes to realtime changes on `randcore_agent_runtime` and shows the canonical registry even when every runtime is offline.
