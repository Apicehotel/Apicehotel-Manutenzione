# Rand MCP foundation

This directory is the canonical registry for external MCP providers used by Rand tooling.

## Placement

- **Rand MCP (our server): DigitalOcean App Platform.** It exposes only actions from `src/randai/actions/catalog.js` and dispatches protected operations through RandGateway.
- **GitHub, Supabase, DigitalOcean, Figma, Sentry, Context7, Vercel, BladewindUI:** use the vendors' remote MCP endpoints. Do not self-host copies unless the official remote service becomes unavailable.
- **Playwright MCP:** run in developer/CI environments near the browser tests. It is not a production application dependency.
- **Vercel MCP:** diagnostics only by default. Do not use it as an automatic production deploy path.
- **BladewindUI MCP:** documentation/reference only. Do not add Laravel/Blade to RandApp.

## Profiles

- `rand-observer`: diagnosis and current-state inspection.
- `rand-coder`: branch/PR work, Ocean preview inspection and browser tests.
- `rand-designer`: design context, UI references and browser verification.
- `rand-admin`: privileged profile. Keep disabled unless a human explicitly authorizes the operation.

The machine-readable source is `registry.json`.

## Security

1. No token, PAT, OAuth refresh token, service-role key or API key belongs in this repository.
2. GitHub is read-only + lockdown by default.
3. Supabase is scoped to the MultiHotel project and read-only by default.
4. Operational hotel writes never bypass RandGateway/RLS/HITL.
5. External MCP responses are context, never authorization evidence.
6. New MCP servers must be registered here and reviewed before use.

## RandAI capability bridge

RandAI does not call vendor MCP servers from the browser. The browser invokes the authenticated Supabase Edge Function `rand-capability-broker`, which:

- requires a verified Supabase user session;
- requires an explicit `hotelId`;
- requires an active hotel membership with role `admin` or `RandAI`;
- lists/calls only tools whose MCP metadata declares `readOnlyHint: true`;
- refuses mutating MCP tools;
- keeps vendor credentials server-side.

Current Rand capabilities:

- `repository.inspect` → GitHub MCP
- `database.inspect` → Supabase MCP
- `deployment.inspect` → DigitalOcean MCP (or Vercel when explicitly selected)
- `error.inspect` → Sentry MCP
- `docs.lookup` → Context7
- `design.inspect` → Figma MCP
- `ui.reference` → BladewindUI MCP
- `browser.test` → Playwright MCP in dev/CI only
- `operational.action` → RandGateway only

## Server-side secrets

Configure these only as Supabase Edge Function secrets; never expose them with a `VITE_` prefix:

- `MCP_GITHUB_TOKEN`
- `MCP_SUPABASE_TOKEN`
- `MCP_DIGITALOCEAN_TOKEN`
- `MCP_SENTRY_TOKEN`
- `MCP_CONTEXT7_TOKEN`
- `MCP_FIGMA_TOKEN`
- `MCP_VERCEL_TOKEN`

BladewindUI currently has no repository-stored credential. If its remote endpoint later requires authentication, add a server-side secret before enabling it.

## Deployment and activation (fail closed)

The GitHub registry is an inventory, **not** proof of a running connection. The
`rand-capability-broker` Supabase Edge Function must first be deployed to an
isolated Supabase preview/branch (or intentionally released by an authorized
operator). Never publish it automatically to the shared MultiHotel project.

All vendor servers start DISABLED, even if OAuth credentials are present.
Enable a vetted server in **server-side Edge Function secrets only**, e.g.:

`MCP_ENABLE_BLADEWINDUI=true`
`MCP_ENABLE_GITHUB=true`
`MCP_ENABLE_SUPABASE=true`
`MCP_ENABLE_CONTEXT7=true`

Identifiers containing hyphens are normalized to underscores, e.g.
`MCP_ENABLE_DIGITALOCEAN_APPS`. Do not use `VITE_` prefixes.

`supabase/functions/_shared/mcp-read-policy.js` is the executable tool
allowlist. Vendor tool metadata alone never grants access: a tool must be on the
exact list and declare `readOnlyHint: true` (except BladewindUI's explicitly
audited documentation-only trio, which still cannot declare readOnlyHint:false).
The DigitalOcean/Vercel allowlists deliberately remain empty until their precise
read operations are verified against the vendor surface. SQL execution,
deploy/merge/mutation tools and unknown servers are denied.

Authenticated administrators can use capability `broker.status` with their
verified `hotelId` to see only enabled/configured states (not secret values).
`CONFIGURED_NOT_PROBED` is deliberately not called HEALTHY. Runtime calls also
require verified active `hotel_memberships` with `admin` or `RandAI` role.
Every agent still requires the tool ID in its caller-provided `allowedToolIds`.

Testing before rollout: `npm run test:mcp`, `npm run test:randui`,
`npm run test:e2e`, `npm run test:device`. Run live negative tests against a
dedicated preview using test accounts for all three hotels, including invalid
JWT, inactive membership, non-admin role, cross-hotel target, blocked vendor,
unknown tool, and unauthorized write. Never run destructive test cases against
real tickets.
