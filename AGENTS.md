# RandApp AI Agent Contract

This file is the canonical engineering contract for AI coding agents working on RandApp - Manutenzione. Read it before changing code, database, PWA behavior, notifications, permissions or deployment.

## Product invariants

- Target platforms are always iOS, Android and Windows. Every UI, layout, dependency and test decision must be evaluated across all three.
- RandApp is multi-hotel: Hotel Giò, Chocohotel and Hotel Il Brigantino. Operational data must remain isolated by `hotel_id` unless an explicitly authorized cross-hotel admin view is required.
- Navigation is not authorization. Final authorization belongs to Supabase/RLS/RPC/Edge Function checks.
- The global `+` is the single creation entry point for operational creation flows unless a product decision explicitly says otherwise.
- The bottom navigation stays compact and mobile-first; Home remains central where the active shell uses the five-item layout.
- Existing six-digit notification codes are permanent once assigned. Do not mutate them casually.

## Working method

1. Read the nearby implementation, tests and latest migration before editing.
2. Prefer the smallest coherent change that fixes the root cause, not a CSS/logic patch pile.
3. Preserve backward compatibility with existing production data and installed PWAs.
4. Do not edit a migration already applied in production. Add a later migration.
5. Never hard-code generated production UUIDs in replay/data migrations when a stable semantic lookup is available.
6. Do not introduce a dependency when the platform API or existing dependency already solves the problem cleanly.
7. Before declaring completion, run or rely on the repository quality gates and verify the actual CI result.

## React and frontend rules

Apply Vercel React engineering guidance:

- Eliminate avoidable async waterfalls; parallelize independent requests with `Promise.all`.
- Avoid unnecessary barrel imports and heavy eager imports.
- Defer optional telemetry/third-party code until needed.
- Keep effect dependencies primitive/stable where practical.
- Prefer derived state during render over effects that merely mirror state.
- Use functional state updates for state derived from previous state.
- Use `Map`/`Set` for repeated lookups in hot paths.
- Avoid defining React components inside other components.
- Keep long operational lists render-efficient; consider `content-visibility` or virtualization only when measurements justify it.
- Do not memoize trivial expressions merely to add complexity.

## Supabase/Postgres rules

Apply Supabase/Postgres best practices:

- RLS and security are critical-path concerns, not optional cleanup.
- Every privileged RPC/Edge Function must authenticate the caller and validate hotel scope and permission/role.
- Service-role operations must remain server-side only.
- Keep RLS predicates index-friendly; avoid repeated expensive auth/subqueries when a safe `select`/initplan pattern can be used.
- Add indexes for real foreign-key/query access patterns, but do not remove indexes solely because a current advisor reports them as unused.
- Prefer constraints that make cross-hotel mismatches impossible, not only application checks.
- Review lock/concurrency behavior for idempotent imports, queues, assignments and completion actions.
- Keep replay migrations deterministic.

## Security review order

For any deep audit or security-sensitive change, review in this order:

1. Vite/build/deployment configuration.
2. Secrets and environment exposure.
3. Rendering of untrusted data/XSS risks.
4. Direct DOM/eval/HTML injection APIs.
5. Auth/session handling.
6. Network/fetch wrappers and external destinations.
7. Redirects, `window.location`, `window.open` and notification click URLs.
8. Third-party scripts and telemetry.
9. Service worker/PWA caching/update strategy.
10. Security headers and CSP posture.

Never place service-role keys, ntfy secret topics, private tokens or credentials in frontend code or repository files.

## PWA and deployment rules

- Missing hashed JS/CSS assets must return a real 404, never SPA `index.html`.
- The service worker must validate dynamic-asset MIME types before caching them.
- JS/CSS should remain network-first so installed PWAs do not stay pinned to obsolete bundles after deploy.
- Navigation may fall back to the app shell only for genuine document navigation.
- Bump the service-worker cache version when cache semantics/app-shell contents change.
- Preserve iOS safe areas, Android viewport behavior and Windows keyboard/focus accessibility.

## Notification rules

- `Priority 5` is reserved for genuine urgent/critical operational alerts. Normal assignments/reminders/tests must not use 5.
- Assignment notifications are personal and must remain recipient-bound.
- Client input must not be trusted to elevate notification priority or choose an unauthorized recipient/topic.
- Keep public human aliases separate from secret/capability-like technical topics where applicable.
- Platform behavior differs: do not assume Android deep-link behavior works on iOS.

## Offline rules

- Offline queue entries must preserve `hotel_id`, action identity and enough metadata for deterministic replay.
- Sync must be idempotent where duplicate execution would create operational damage.
- Never silently move an offline operation to a different hotel after hotel switching.
- Surface failed syncs through diagnostics rather than dropping them.

## Testing contract

For non-trivial changes, the expected quality path is:

```bash
npm ci
npm audit --audit-level=high
npm run test:matrix
npm run test:critical
npm run build
node scripts/check-bundle.mjs
npm test
npm run test:e2e
npm run test:device
```

The CI workflow is the authoritative automated gate. A local build alone is never enough for UI, PWA or cross-platform claims.

For rendered UI changes, verify at minimum:

- meaningful page renders (not blank),
- no framework error overlay,
- no relevant console error,
- target interaction changes real UI state,
- one mobile viewport and desktop when practical,
- clipping/overlap/touch targets/safe area,
- iOS/WebKit path for mobile-sensitive changes.

Physical-device claims require physical-device evidence; Playwright emulation is not hardware certification.

## Agent source references

This contract is aligned with current guidance from:

- Vercel React Best Practices / React composition guidance;
- Supabase Agent Skills and Supabase Postgres Best Practices;
- OpenAI security-best-practices guidance for JavaScript/TypeScript/React web frontends;
- Vite/Vite React agent guidance;
- the repository's own Quality Matrix, Critical Gate and device acceptance tests.

When external guidance conflicts with RandApp's product invariants or production data safety, preserve the invariant and document the tradeoff.
