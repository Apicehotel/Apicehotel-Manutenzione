# Agent-Native action contract

## Decision

RandApp adopts the strongest Agent-Native pattern — **define an application capability once and reuse it across UI, agent and MCP** — without installing Agent-Native as a second application runtime.

RandGateway remains the canonical security boundary:

`Adapter → RandGateway → identity/hotel/role → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Agent-Native does not replace Supabase, RLS, RandGateway, RandAI, MCP, HITL, audit or the existing UI shell.

## Why not install the full runtime now

RandApp already owns authentication, multi-hotel authorization, Supabase/Postgres data, MCP transport, audit, approval binding and action execution. Installing another runtime for the same responsibilities would violate the one-owner rule and create duplicated authorization and persistence paths.

The compatibility layer is therefore intentionally small:

- `src/randai/actions/catalog.js` is the shared application-action catalog.
- RandApp validates that browser-requested actions exist in that catalog.
- `api/mcp.js` generates MCP tools from the same catalog.
- Server-side `randai-action-policy.js` remains the independent authorization source of truth.
- Tests require catalog metadata and server policy to stay aligned.

## Current shared actions

- `issue.update_priority`
- `issue.set_waiting_part`
- `issue.mark_done`

All three are private, hotel-scoped, protected writes and require HITL. They are exposed to RandApp, RandAI/agent callers and the internal MCP surface, never to a public agent surface.

## Future evolution

New actions should be added to the shared catalog only when a real product surface needs them. Security policy remains server-side and fail-closed. If a future standalone Agent-Native worker becomes useful, it must call RandGateway rather than owning operational authorization or writing Supabase tables directly.

A future bridge may translate catalog definitions to Agent-Native `defineAction()`, but its `run()` must dispatch to RandGateway and must not become another executor.
