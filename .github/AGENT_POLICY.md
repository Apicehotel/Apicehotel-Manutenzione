# Agent Change & Deployment Policy

## Permanent freeze on autonomous writes to `main`

Effective immediately and permanently for RandApp/RandAI/RandCore and connected automation:

1. No autonomous agent (Codex, RandAI, bots, workflows, or external automation) may commit or push directly to `main`.
2. Agent-generated changes must be made on a dedicated branch.
3. Every agent-generated change must be submitted through a Pull Request targeting `main`.
4. A human reviewer must review and approve before merge.
5. Force-pushes to `main` are forbidden.
6. Production deployment must not be triggered by an agent simply pushing code.
7. Production deploys are manual unless a future governance decision explicitly re-enables an approved gated flow.
8. CI may run automatically, but CI is a verifier, not an authority to merge or deploy.

## Required flow

`main` -> `agent/*` or feature branch -> changes -> tests -> Pull Request -> human approval -> merge -> manual production deploy

## Non-goals

This policy does not block normal development. It blocks only autonomous write/deploy authority over production.

## GitHub repository settings required

This file documents repository policy but does not replace GitHub branch protection. The `main` branch must also have a GitHub ruleset / branch protection rule enforcing:

- Require a pull request before merging.
- Require at least 1 approval.
- Require status checks to pass before merging.
- Block force pushes.
- Block branch deletion.
- Do not allow apps/bots/agents to bypass the rule.
- Restrict direct pushes to `main`.

Any agent that cannot comply with this workflow must be treated as read-only with respect to `main` and production.
