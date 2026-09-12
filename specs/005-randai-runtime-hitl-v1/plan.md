# PLAN: 005-randai-runtime-hitl-v1

## Canonical owners
- AutonomyEngine / autonomy decision: keep.
- AgentRuntime / Coordinator: keep.
- Action Gateway: keep as sole protected-action approval/execution boundary.
- RandSecure: keep as restrictive decision owner.
- RandDurableRuntime: keep for resume/retry.
- RandAudit: keep for evidence.

## Current state
The repository already has autonomy evaluation, agent coordination/runtime, protected-action approval through Action Gateway, durable execution, tool authorization and governance. The missing piece is a single execution-risk/HITL contract and explicit sandbox boundary.

## Proposed change
Add a canonical risk policy, a thin HITL coordinator that delegates approvals to Action Gateway, and a sandbox descriptor that denies unrestricted host execution. Do not add a second approval store or orchestrator.

## RandRadar decision
- CloddsBot: ADAPT patterns only (routing, skills, fallback); do not install runtime.
- MathModelAgent: SOURCE_ONLY patterns (specialists, HITL, sandbox); do not install due domain/license/runtime overlap.
- No new runtime dependency.

## Rollback
Remove `src/randai/runtime/{risk-policy,sandbox,hitl-runtime}.js`, Group 7 test/workflow and this spec. Existing autonomy, agents, Action Gateway, RandSecure and DurableRuntime remain untouched and continue operating as before.

## Tests and evidence
- Group 7 HITL runtime contracts.
- Existing `test:autonomy` regression.
- Group 1 security boundary.
- RandSpec validator.
- Full CI plus Groups 1-7 before converge.

## Implementation
1. canonical risk policy;
2. sandbox descriptor fail-closed;
3. HITL coordinator using injected canonical approval adapter;
4. Group 7 contracts + regression against prior boundaries;
5. docs/README/ecosystem;
6. converge only after all CI gates are green.

## Zombie check
Do not remove autonomy, agents, Action Gateway, RandSecure or DurableRuntime: they own distinct capabilities. Any new duplicate owner is rejected.
