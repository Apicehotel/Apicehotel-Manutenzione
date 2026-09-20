# RandUI design direction

## Visual language

Clear, calm, operational, high-contrast, and trustworthy. Use hierarchy and spacing to make status and next action obvious. Avoid decorative SaaS patterns, excessive cards, gradients, tiny secondary text, and ambiguous icon-only actions.

## Layout

Use the existing RandUI shell, page schemas, templates, component registry, canonical gutters, safe-area handling, and bottom navigation. Remove accidental empty space and prevent nested scrolling, clipping, and horizontal overflow.

## Interaction

Primary actions must be visually and semantically primary. Destructive or high-impact actions require confirmation and clear feedback. Loading, empty, error, stale, offline, and success states must be distinguishable.

## Accessibility

Support keyboard focus on Windows, touch targets on mobile, reduced motion, readable contrast, screen-reader names, and Grande mode. Never communicate status by color alone.

## Operational restraint

Animation is purposeful and short; no bounce/elastic motion. Keep staff workflows faster than decorative polish. Any change must preserve hotel scope, role visibility, and offline/reconnection behavior.
