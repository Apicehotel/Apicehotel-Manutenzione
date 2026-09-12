# PLAN: 005-randai-runtime-hitl-v1

## Existing owners
- AutonomyEngine / autonomy decision: keep.
- AgentRuntime / Coordinator: keep.
- Action Gateway: keep as sole protected-action approval/execution boundary.
- RandSecure: keep as restrictive decision owner.
- RandDurableRuntime: keep for resume/retry.
- RandAudit: keep for evidence.

## RandRadar
- CloddsBot: ADAPT patterns only (routing, skills, fallback); do not install runtime.
- MathModelAgent: SOURCE_ONLY patterns (specialists, HITL, sandbox); do not install due domain/license/runtime overlap.
- No new runtime dependency.

## Implementation
1. canonical risk policy;
2. sandbox descriptor fail-closed;
3. HITL coordinator using injected canonical approval adapter;
4. Group 7 contracts + regression against Groups 1-6;
5. docs/README/ecosystem;
6. converge only after all CI gates are green.

## Zombie check
Do not remove autonomy, agents, Action Gateway, RandSecure or DurableRuntime: they own distinct capabilities. Any new duplicate owner is rejected.
