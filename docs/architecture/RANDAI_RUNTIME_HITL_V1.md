# RandAI Runtime / HITL / Sandbox v1

## Purpose

Punto 6 converge gli owner esistenti senza creare Approval2, Sandbox2 o un secondo orchestratore.

## Canonical flow

`objective -> AgentRuntime/Coordinator -> tool contract -> risk policy -> HITL decision -> Action Gateway when approval is required -> governed tool execution -> RandAudit/RandMind verified outcome`

## Risk policy

- READ_ONLY: automatic, no mutation.
- LOW_RISK: automatic, audit when mutating.
- MEDIUM_RISK: preview/explicit confirmation before execution.
- HIGH_RISK / WRITE_PROTECTED / ADMIN: human approval through the canonical Action Gateway.
- CRITICAL: blocked by this runtime; a dedicated human/admin process must be used.

## Ownership

- existing AutonomyEngine remains policy/evaluation owner;
- RandSecure remains restrictive security-decision owner;
- Action Gateway remains prepare/approve/execute/reject owner;
- AgentRuntime/Coordinator remain agent orchestration owners;
- RandDurableRuntime remains long-running/resume owner;
- RandAudit remains evidence owner;
- this layer only normalizes execution risk, HITL handoff and sandbox requirements.

## Sandbox

The runtime never grants unrestricted host execution. Sandbox descriptors are declarative and deny host execution by default. External/code-execution adapters may be added later only behind the same tool authorization, hotel scope, audit and human-approval boundaries.

## Future connections

Punto 7 MCP/Gateway/RandChat must consume this policy before exposing any mutating tool. MCP is transport/tool discovery, never a permission authority.
