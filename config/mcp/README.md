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
