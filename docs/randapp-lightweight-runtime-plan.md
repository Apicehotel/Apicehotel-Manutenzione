# RandApp lightweight runtime plan

This branch documents the staged lightweight architecture. No production configuration changes.

## Always available
- Authentication, hotel selection, RLS-enforced operational views
- Home, issues, maintenance, tasks, planning, notifications
- RandAI conversation and approved tool gateway

## On-demand / Laboratory
- Research, audio, Viking, skill management, diagnostics and experiments
- Load each UI route via dynamic import only after navigation
- Start subscriptions, timers and network requests only while mounted
- Cancel pending requests and subscriptions on exit
- Gate server-side workers separately; hiding a menu item does not stop backend jobs

## Safety gates
1. Capture current bundle sizes and network waterfall on mobile.
2. Map imports and background jobs before moving any module.
3. Introduce route-level React.lazy and Suspense boundaries, one module at a time.
4. Preserve permission checks on both client and server.
5. Test offline/PWA updates, housekeeping roles, hotel isolation, RandAI tool approvals.
6. Verify DigitalOcean preview manually; keep Vercel automatic deployment disabled.
7. Merge only after tests and human approval.

## Acceptance criteria
- No optional module downloaded on initial home load unless explicitly needed.
- Optional module timers and subscriptions stop on unmount.
- Core operational routes continue working for each authorized role.
- No database schema, secrets or production deploy changed by this planning commit.
