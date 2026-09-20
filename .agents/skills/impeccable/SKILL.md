---
name: impeccable
description: Govern RandUI visual design reviews and controlled frontend refinement with Impeccable.
license: Apache-2.0
compatibility: Requires Node.js 22.18+ and a trusted project workspace.
metadata:
  source: https://github.com/pbakaus/impeccable
  pinned_version: "4.1.0"
---

# Impeccable for RandApp

Use Impeccable as a design-review and controlled refinement layer. It does not replace RandUI, the RandApp shell, Supabase authorization, the Quality Matrix, or human review.

## Required guardrails

- Work only on a feature branch and open a PR; never push, merge, or deploy `main`.
- Read `AGENTS.md`, `.impeccable/PRODUCT.md`, and `.impeccable/DESIGN.md` before making UI changes.
- Preserve the RandUI ownership model and existing page schemas/templates.
- Do not add a new component library, navigation system, icon system, or CSS framework.
- Do not use `bolder`, `overdrive`, or decorative motion on operational screens without an explicit product decision.
- Verify iOS/WebKit, Android/Chromium, Windows/desktop, safe areas, keyboard focus, reduced motion, touch targets, and multi-hotel parity.
- Run the repository quality gates before reporting completion.

## First setup

From the repository root, in a trusted development workspace:

```bash
npx impeccable@4.1.0 install --providers=codex --scope=project
```

Approve the project hook only after inspecting the generated files. Keep ephemeral `.impeccable/` output ignored; commit only deliberate shared design artifacts.

## Canonical workflow

```text
/impeccable init
/impeccable document
/impeccable shape <surface>
/impeccable critique <surface>
/impeccable audit <surface>
/impeccable layout <surface>
/impeccable adapt <surface>
/impeccable harden <surface>
/impeccable polish <surface>
```

Use `typeset` for Grande mode/readability and `clarify` for operational labels. Use `live` only for visual inspection; every accepted change still goes through the normal PR and CI gates.

## RandApp surfaces

Prioritize Home, Segnalazioni, Interventi, Planning, Rifornimenti, RandGuide, RandAI, Warehouse, Utenti/Ruoli, and RandChat. Check the same surface in Hotel Giò, Chocohotel, and Il Brigantino.

## Completion evidence

Report the surface audited, findings, files changed, screenshots or browser evidence when available, and the exact commands/tests that passed.
