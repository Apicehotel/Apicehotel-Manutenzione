# RandUI v1 — Block 3 Page Migration

## Purpose

Block 3 moves every current RandApp/RandAI destination under the declarative RandUI contract created in Blocks 1–2 without rewriting domain behavior.

The migration rule is:

`Shell destination → Page Catalog → PageBoundary → Template Registry → Component Registry → Guard → existing domain content`

The boundary adapts current screens to RandUI. It does not create a second navigation system, second design system or second data layer.

## Coverage

The catalog now covers 23 current destinations, including secondary runtime views that were not in the original 19-page planning list: `my-work`, `pin`, `feedback-received` and `desktop-download`.

Every catalog entry carries `migration: template-boundary-v1`. Unknown destinations fail closed instead of silently rendering outside RandUI.

`Settings` already consumes `SettingsTemplate` directly. The standalone `/randai` console remains catalogued as `monitor`; the authenticated RandApp Shell wraps all of its operational destinations through `PageBoundary`.

## Compatibility strategy

The boundary intentionally preserves existing domain components and their behavior. Many modules still own domain-specific CSS because those styles are not automatically zombies merely because the outer page is migrated.

The following old wrappers were safe to remove because they existed only as legacy migration shells and no longer own behavior:

- `rs-legacy--temperature` around Temperature;
- `rs-legacy--temperature` around Plants;
- `rs-legacy--housekeeping` around Housekeeping.

Domain CSS is removed only after its selectors have no active consumer. This keeps Block 3 reversible and avoids a cosmetic cleanup causing operational regressions.

## Certification

`npm run test:randui:migration` verifies complete catalog coverage and fail-closed template compatibility.

`npm run test:randui` runs Core + Guard + Migration together. The normal CI then continues through build, shared contracts, Chromium/WebKit, device acceptance, RandCore health and LTS attestation.

A new page is not complete until it is added to `page-catalog.js` and therefore can pass through `PageBoundary` or a direct canonical template such as `SettingsTemplate`.

## Future refinement

Block 3 deliberately separates **migration** from **redesign**. Once every route is inside RandUI, individual modules can be refined by replacing internal local layout with richer template slots without changing navigation, permissions, data contracts or the outer responsive geometry.
