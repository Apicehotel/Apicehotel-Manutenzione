# PLAN: release-readiness-v1

## Canonical owners
- PWA/runtime: RandApp.
- Browser/device acceptance: Playwright + existing device gate.
- Release governance: RandCore/RandFlow + human review.
- Android packaging: external build/signing step, subordinate to release gate.

## Current state
Automated device acceptance already covers iPhone/WebKit, Android/Chromium and Windows-like Chromium. A prior generic release gate existed only on an intermediate branch.

## Proposed change
Restore the pure release gate on the consolidated branch and split evidence by target. Android adds signed package and real-device verification without changing the web release contract.

## RandRadar decision
- WebToApp: WATCH / optional bridge only, not canonical owner.
- SimUtil / AYA: TEST TOOL candidates, no runtime dependency.
- Playwright: KEEP as canonical automated cross-platform gate.

## Rollback
Delete release gate files/scripts. No database, auth, RLS or operational state migration is involved.

## Tests and evidence
- `node --test test/release-readiness-v1.test.js`
- `npm run test:device`
- canonical CI/build/audit remain authoritative.

## Zombie check
Do not create a second E2E suite, second PWA runtime or duplicate device matrix. Old branch-only release gate is source material, not a second active owner.
