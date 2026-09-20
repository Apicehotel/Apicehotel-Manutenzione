---
name: resolve-agent-reviews
description: Safely triage bot review findings on the current RandApp pull request.
license: MIT
compatibility: Requires Node.js 18+ and GitHub authentication through gh or GITHUB_TOKEN.
metadata:
  source: https://github.com/pbakaus/agent-reviews
  pinned_version: "1.1.0"
---

# Resolve agent reviews for RandApp

Use `agent-reviews` to inspect bot comments from the current PR. This skill is a review assistant, not an autonomous merge or deployment system.

## Hard boundaries

- Only operate on the current feature branch and its PR.
- Never push to, merge, or deploy `main`.
- Do not post replies, resolve threads, commit, or push without explicit user authorization for that action.
- Evaluate every finding as true positive, false positive, or uncertain.
- Ask the user when a finding concerns business logic, permissions, hotel scope, migrations, security, or architecture.
- Run the repository gates after fixes; do not declare success from a clean bot queue alone.

## Read-only triage

```bash
npx agent-reviews@1.1.0 --bots-only --unanswered --expanded
```

Inspect the referenced code, tests, and PR diff. Record the comment ID and decision in the final report.

## Controlled fix flow

1. Fetch the finding and relevant code.
2. Make the smallest root-cause fix on the feature branch.
3. Run the applicable tests and security checks.
4. Show the user the proposed commit/reply plan.
5. Only after approval, commit/push and reply to the review thread.
6. Leave the thread open for fixes that need reviewer verification; resolve only confirmed false positives or explicitly skipped findings.
7. Do not use watch mode automatically. Run it only when the user explicitly asks.

## Useful commands

```bash
npx agent-reviews@1.1.0 --bots-only --unanswered --expanded
npx agent-reviews@1.1.0 --detail <comment-id>
npx agent-reviews@1.1.0 --json
```

This local policy intentionally narrows the upstream workflow to RandApp's human-review and protected-main rules.
