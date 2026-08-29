# RandApp runtime architecture

Architecture review baseline after the 18-point consolidation.

## Trust boundaries
- Device: iOS, Android and Windows React/Vite PWA; offline work remains local until sync.
- Supabase authenticated: browser uses an authenticated session; RLS is authoritative.
- Privileged server: Edge Functions own server secrets, canonical identity checks and private topic derivation.
- Notification transports: Web Push and ntfy deliver messages but do not authorize users.

## Core components
- React/Vite PWA: UI, routing, hotel context.
- Auth: PIN login, session validation and sign-out.
- Permissions: UI capability checks backed by RLS.
- Hotel context: isolates Gio, Choco and Brigantino.
- Operational modules: issues, interventions, planning, housekeeping, reminders and urgent work.
- Offline layer: drafts, queue and retry preserving hotel_id.
- Notification onboarding/routing: Push capability and destination routing.
- Supabase Postgres: canonical data, memberships, permissions and RLS.
- Supabase Edge Functions: auth gates, notification dispatch/resolution and privileged operations.
- Web Push / ntfy: delivery transports.

## Primary path
User -> PWA -> authenticated session -> hotel context -> permission check -> Supabase RLS -> operational record -> notification dispatcher -> Push/ntfy -> recipient -> PWA destination.

## Invariants
- Every hotel-scoped operational record preserves hotel_id.
- Hotel data cannot cross hotel boundaries.
- Navigation visibility never substitutes for authorization.
- PIN verification and privileged secrets stay server-side.
- Personal ntfy topics stay server-derived; aliases are identifiers, not secrets.
- Backend controls notification priority: urgent 5, assignment 4, routine/test 3.
- Six-digit notification codes are immutable after assignment.
- Global + remains the centralized creation launcher.
- iOS, Android and Windows remain acceptance targets.
- The 18-point consolidation remains the baseline; later work is incremental and regression-tested.

## Boundary review gate
Any change crossing a trust boundary must document: authenticated identity, hotel_id enforcement, permission/RLS authorization, secret exposure, offline/retry behavior, iOS/Android/Windows behavior, and its regression test.

## Archify workflow
Archify is a development/review tool, not a RandApp runtime dependency. Generate bounded repository-backed maps from this baseline, validate them before review use, and never add Archify to the production bundle.
