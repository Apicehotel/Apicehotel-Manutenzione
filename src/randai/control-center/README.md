# RandAI Control Center

The Control Center is a read projection over authoritative RandAI stores. It does not create a second source of truth.

Operational sections:
- ACTIVE: running/planned/actioned work
- ATTENTION: unresolved non-terminal conditions
- PROPOSALS: proactive/discovery proposals
- BLOCKED: approvals and review gates
- COMPLETED: verified/resolved work

Source health:
- READY: source read successfully
- ERROR: source failed, snapshot remains partial and is DEGRADED
- NOT_CONFIGURED: source absent; all absent sources produce NO_DATA

Proactive actions must always route through RandAI Supervisor and existing autonomy/permission controls before side effects.
