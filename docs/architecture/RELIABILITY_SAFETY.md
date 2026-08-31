# RandApp / RandAI Reliability & Safety

## Block 33 — Reliability Foundation

Operational work is correlated through a versioned `Operation Envelope` in `src/reliability/operation-envelope.js`. The envelope carries the minimum execution identity needed across RandApp and RandAI: operation, hotel, actor/role, module/action, record, source and correlation/trace identifiers.

## Block 34 — Context & Scope Guard

`src/reliability/context-scope-guard.js` is the application preflight for operational scope. It is deterministic and deny-by-default when required context is absent.

The guard can validate:

- expected hotel against UI/RandAI context and record hotel;
- expected actor against context actor;
- expected module against current screen/view;
- expected resource type/id against current resource and loaded record;
- explicit permission results supplied by the authoritative permission layer;
- ownership requirements with an explicit privileged bypass.

Stable block reasons are:

- `MISSING_CONTEXT`
- `HOTEL_MISMATCH`
- `ACTOR_MISMATCH`
- `RESOURCE_MISMATCH`
- `PERMISSION_DENIED`
- `OWNERSHIP_MISMATCH`
- `MODULE_MISMATCH`

The guard does **not** replace database authorization. It prevents invalid or ambiguous operations before network effects, while Supabase membership, grants/RLS and server-side permission checks remain authoritative.

### RandAI Action Gateway

Before `prepareRandAIAction` calls the Edge Function, RandApp requires a matching context for hotel, `issues` module and issue resource. A missing context, wrong hotel or wrong issue is blocked locally with `SCOPE_GUARD_BLOCKED`.

The Edge Function remains the final authority: it verifies the authenticated user, active hotel membership, role permission, resource lookup scoped by `hotel_id`, state transition and optimistic concurrency before executing a write.

### Design decisions

- KEEP the existing Operational Context Layer instead of creating a second context system.
- KEEP Supabase/RLS and Action Gateway as the authorization authority.
- ADD one reusable deterministic application guard.
- Do not introduce OPA/Casbin/another policy runtime yet: current policy volume does not justify an additional distributed policy engine and its synchronization/operational cost.
- Keep telemetry context minimal; credentials, PINs, tokens and unnecessary personal data must not be propagated.

### Test contract

`test/reliability-context-scope-guard.test.js` covers allow, missing context, cross-hotel, wrong resource, actor mismatch, permission denial, ownership enforcement and privileged ownership bypass.
