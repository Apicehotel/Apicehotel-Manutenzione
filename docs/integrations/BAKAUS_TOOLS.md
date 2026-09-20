# Paul Bakaus tools in RandApp

This repository adopts two upstream tools as development aids:

- [Impeccable](https://github.com/pbakaus/impeccable) for design guidance, frontend audits, and controlled visual iteration.
- [agent-reviews](https://github.com/pbakaus/agent-reviews) for triaging review-bot comments on pull requests.

Neither tool is part of the production runtime. Neither tool replaces RandUI, RandCore, Supabase RLS/RPC, the Quality Matrix, or human approval.

## Installation

Use Node 24 and a trusted feature branch:

```bash
npx impeccable@4.1.0 install --providers=codex --scope=project
```

The project-local skill is already documented under `.agents/skills/impeccable/`. Inspect generated hooks before approving them. Do not commit runtime caches, screenshots, sessions, or local secrets.

## Recommended UI pass

```text
/impeccable init
/impeccable document
/impeccable critique <surface>
/impeccable audit <surface>
/impeccable layout <surface>
/impeccable adapt <surface>
/impeccable harden <surface>
/impeccable polish <surface>
```

Start with operational surfaces and compare all three hotels. Use the RandApp Quality Matrix as the release authority.

## Recommended PR pass

```bash
npx agent-reviews@1.1.0 --bots-only --unanswered --expanded
```

Findings must be evaluated before code changes. Fixes affecting permissions, hotel scope, migrations, notifications, offline replay, security, or architecture require human direction. No automatic merge, deployment, or main-branch push is permitted.

## Version policy

Versions are pinned in the local skills so updates are deliberate. A future update requires a separate PR with changelog review, security review, and a re-run of the relevant quality gates.
