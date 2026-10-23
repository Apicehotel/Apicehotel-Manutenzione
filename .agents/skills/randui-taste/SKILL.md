---
name: randui-taste
description: Apply Taste Skill v2 app-screen review to RandUI without changing application capabilities.
license: MIT
metadata:
  upstream: https://github.com/Leonxlnx/taste-skill
  mode: app-screens
---

# RandUI × Taste Skill — controlled design profile

Use Taste Skill **app screen** workflow, never the marketing-page workflow. Before designing, read:
- `AGENTS.md`, `.impeccable/PRODUCT.md`, `.impeccable/DESIGN.md`
- `src/randapp/shell-navigation.js`, `src/randapp/Shell.jsx`
- Upstream `skills/taste-skill/SKILL.md` and **entire** `skills/taste-skill/references/app-screens.md`.

The upstream tool's scripts are NOT vendored here. Install/run them separately in a trusted workspace after review. Use `node <taste-skill>/scripts/draw.mjs --app` for an app-screen direction and `node <taste-skill>/scripts/inspect.mjs --app` for inspection, following the upstream instructions and Node/Chromium prerequisites. Do not pretend browser inspection passed without running it.

## User-approved design intensity (directive values, not upstream flags)
- `DESIGN_VARIANCE: 10/10`: maximum originality within RandUI's functional UI contract.
- `VISUAL_DENSITY: 9/10`: compact but readable controls, real records, no invented data.
- `MOTION_INTENSITY: 8/10`: expressive but useful transitions, reduced-motion alternative mandatory; no motion that slows workflows, interrupts focus, or impairs accessibility.

## Immutable product constraints
- Three **separately designed** size templates: Piccolo, Normale, Grande. No mere scaling.
- Mobile primary navigation for authorized maintenance and congress-director roles:
  **Operatività → Planning → Home → Task → RandAI**; Home remains slot 3.
- RandAI opens the **actual assistant** (`RandAIAssistant`, view `randai`), not RandChat. The complete menu remains available from the profile.
- Preserve all existing roles, guards, hotel scope, Supabase RLS, API calls, operational data, offline semantics, PWA flows and backend logic. Where a role explicitly denies RandAI, retain the existing safe fallback: never bypass permissions to enforce a visual slot.
- Respect established housekeeping role-specific navigation: do not broaden the role-specific contract without separate approval.
- No new design system, UI framework or runtime dependency; reuse existing components, tokens and layout contracts.
- Never modify `main` directly, merge or deploy autonomously. Work through PR review.

## Review and acceptance sequence
1. Capture baseline visual evidence for one real RandUI surface; identify specific measurable issues.
2. Derive a direction with Taste Skill's `--app` workflow, keeping existing palette/type where contractually fixed. Record why chosen.
3. Change only presentation components/styles in a feature branch; preserve layout and authorization invariants.
4. Inspect actual rendered app with `inspect.mjs --app`; verify screenshots at Piccolo, Normale and Grande, plus iOS/WebKit, Android and desktop widths.
5. Verify navigation, RandAI direct entry, profile menu, top-three groups, reduced motion, responsive safe areas, clipping and keyboard/touch behavior.
6. Run `npm run test:matrix`, `npm run test:critical`, `npm run build` and CI. Record exact results, not assumptions.
7. Update README and open a PR for review. No merge or deploy without user confirmation.
