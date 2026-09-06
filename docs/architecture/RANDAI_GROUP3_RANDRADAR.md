# Group 3 RandRadar decision

Compared roles: Trigger.dev and Inngest for durable execution; Mastra for TypeScript agent orchestration; LangGraph as durable agent reference. Decision: adopt their useful patterns behind Rand contracts, do not add them as PWA dependencies now. Trigger.dev remains first external executor candidate when a concrete server-side durable workload justifies activation. This avoids duplicated orchestration ownership and preserves rollback.
