---
name: randapp-quality-gate
description: Orchestrate RandApp certification checks across Supabase, security, Playwright, offline resilience, multi-hotel isolation, accessibility, performance, CI and production canary. Use for roadmap points 19-29 and before declaring a RandApp change complete.
---

# RandApp Quality Gate

Use this skill only for `Apicehotel/Apicehotel-Manutenzione`.

## Completion rule
Never mark work complete only because implementation exists. Require the applicable build, automated tests and regression checks to pass.

## Existing project gates
Run and respect the existing project commands before inventing replacements:
- `npm run build`
- `npm run test:quality`
- `npm run test:e2e` when browser flows are affected
- `npm run test:device` when responsive/platform behavior is affected

## Mandatory dimensions
Always evaluate:
- hotels: Hotel Gio, Chocohotel, Brigantino;
- platforms: iOS/WebKit, Android/Chromium, Windows/Chromium;
- network: online, offline, reconnect;
- roles and permissions;
- Supabase RLS as the server-side authority.

## Security order
For security-sensitive work:
1. build architectural context;
2. identify trust boundaries and assets;
3. verify auth/session and role transitions;
4. verify RLS and cross-hotel denial;
5. review changed code and migration diff;
6. run static/security checks;
7. run regression tests.

Frontend guards are never sufficient proof of authorization.

## Multi-hotel isolation
For each hotel, verify positive access to its own data and negative access to the other two hotels. Apply this to issues, planned work, housekeeping, photos/storage paths, notifications, users and any new hotel-scoped entity.

## Offline / chaos
For mutations affected by offline support, exercise at least:
- create online then disconnect;
- create/update while offline;
- photo staged while offline;
- reconnect during pending queue;
- repeated retry;
- double action/double tap;
- refresh during sync;
- Supabase temporarily unreachable.

Expected result: no silent loss, no unintended duplicate, no cross-hotel replay.

## Files and photos
For housekeeping imports, prefer deterministic fingerprint/idempotency checks before import. Preserve the privacy boundary.
For photos, validate content type based on actual bytes where practical, dimensions/size before upload, offline staging, Storage path scoping and signed/public URL behavior as applicable.

## Browser and visual checks
Prefer the project's existing Playwright stack. Add another framework only when it covers a real gap. Check safe areas, bottom navigation, large-size mode, forms, dialogs, keyboard interaction and representative mobile/desktop layouts.

## Production gate
A successful deployment is not sufficient. Verify critical smoke paths after deploy: app load, auth/session, hotel selection/scope, representative read/write, Storage/photo path, realtime/notifications where testable, and offline recovery.

## External specialist skills
When available, combine this project skill with:
- `supabase/postgres-best-practices`
- `openai/security-threat-model`
- `openai/security-best-practices`
- `trailofbits/audit-context-building`
- `trailofbits/differential-review`
- `trailofbits/insecure-defaults`
- `trailofbits/sharp-edges`
- `trailofbits/static-analysis`
- `openai/playwright`
- `addyosmani/web-quality-audit`
- `addyosmani/core-web-vitals`
- `addyosmani/accessibility`
- `openai/gh-fix-ci`

Do not install overlapping skills merely to increase tool count.