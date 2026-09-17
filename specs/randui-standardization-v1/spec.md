# SPEC: randui-standardization-v1 — RandUI portable standards

## Status
IMPLEMENTED_PENDING_REVIEW

## Problem
RandUI v1 already owns shell, templates and responsive behavior, but token, motion and icon governance are not exposed as one portable contract for design bridges, agents and future native targets.

## Outcome
RandUI keeps version 1.0.0 while a separately versioned standardization contract governs portable tokens, motion and semantic icons without adding a second design system.

## Scope
### In
- portable design tokens
- motion contract with reduced-motion fail-safe
- semantic icon adapter and policy
- automated contract tests and documentation

### Out
- replacing the current icon runtime in this change
- adding Anime.js or other runtime libraries without measured benefit
- removing the Ocean preview while it is referenced

## Users and roles
- RandApp users benefit from consistent, accessible UI.
- Developers and agents receive one verifiable UI contract.

## Requirements
- R1: `RANDUI_VERSION` remains 1.0.0.
- R2: standardization is independently versioned.
- R3: touch minimum is 44px and reduced-motion remains mandatory.
- R4: icons use one semantic adapter and one runtime owner.
- R5: no new runtime dependency is required.

## Acceptance criteria
- AC1: existing RandUI contract tests remain green.
- AC2: new standardization tests are green.
- AC3: production build and bundle budget remain green.
- AC4: Ocean/browser/device gates do not regress.

## Security and hotel isolation
UI-only change. No RLS, RPC, permissions, secrets, identity, hotel scope or data boundary is modified.

## UX and devices
Preserve responsive matrix, safe-area, 44px touch targets, keyboard/focus behavior and `prefers-reduced-motion` across supported devices.

## Data and retention
N/A: no operational schema or persisted user data changes.

## Observability and recovery
Rollback is deletion of the new contracts/tests and restoration of the previous `design-contract.js`; no data migration is required.

## Open questions
NONE
