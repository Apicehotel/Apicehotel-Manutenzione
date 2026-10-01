# RandUI Free UI/UX Source Map

RandUI remains the only runtime design system. External free/open-source libraries are treated as design knowledge, not stacked framework dependencies.

Studied sources: ReUI, shadcn ecosystem, Motiq, Animate UI, Velora UI, Radian UI, AI Canvas and Rare UI.

The persistent machine-readable knowledge lives in `src/randapp/randui/ui-learning-catalog.json`. New discoveries must record provenance, useful patterns, use cases, anti-patterns and current license notes before they are adopted.

Rules:
1. No second UI runtime only for appearance.
2. Components are registered in RandUI before use.
3. Permissions, Page Schema, responsive geometry and safe-area owners stay authoritative.
4. Reduced motion is mandatory.
5. Copy code only when the current license is compatible and attribution obligations are satisfied.
6. Prefer native reimplementation over dependency accumulation.
7. RandAI/RandDesign may recommend from the catalog, but cannot bypass RandUI Guard.
