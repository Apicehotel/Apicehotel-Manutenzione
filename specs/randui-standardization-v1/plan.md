# PLAN — randui-standardization-v1

## Canonical owners
- RandUI v1 remains owner of shell, templates, components and responsive geometry.
- `design-tokens.json`, `motion-contract.js` and `icon-contract.js` extend that owner; they do not create parallel systems.

## Current state
RandUI v1 is integrated. Foundation CSS already covers touch target, reduced motion and defensive overflow. Icons are centrally rendered by `src/randapp/ui.jsx#Icon`.

## Proposed change
Add portable tokens, independently versioned motion, semantic icon mapping and tests. Keep the existing icon runtime until an adapter-first migration can be verified atomically.

## RandRadar decision
Penpot/M3E Canvas: SOURCE/TOOL. MingCute: ADAPT target behind adapter. Anime.js: WATCH; add only if measured complexity/bundle improves. ux-ui-agent-skills: ADOPT quality patterns, not a second runtime.

## Rollback
Revert the new contract files, test and design-contract additions. No DB/data rollback is needed.

## Tests and evidence
Existing `npm run test:randui`, `npm test`, build, bundle, RandDesignBridge, browser/device and Ocean Preview plus `test/randui-standardization-v1.test.js`.

## Zombie check
No deletion. `/ui-v2-preview` and `randui-v2` remain because Ocean/CI still reference them. Removal is allowed only after runtime + CI references are zero and a verified replacement exists.
