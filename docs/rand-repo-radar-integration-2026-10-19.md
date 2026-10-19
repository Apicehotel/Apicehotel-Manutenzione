# Rand Repo Radar — controlled integration (2026-10-19)

Status: **draft / approval required**. Scope: Apicehotel-Manutenzione only. No changes to `main`, deployment, production environment, UI, auth, or Supabase.

## Existing stack confirmed

- Node 24, React 19, Vite 7, Playwright, Node test runner.
- `npm audit --audit-level=high` already runs in the main CI.
- `test:chaos`, `test:e2e`, `test:device`, `test:randui`, RandCore health and freeze gates exist.
- Sentry, OpenTelemetry, TanStack Query and Dexie are dependencies; do not reinstall them as new tools.
- The main CI currently has workflow-level `id-token: write` and uses tagged third-party actions. Review with Zizmor; do not change privileges blindly if OIDC is needed elsewhere.
- A search of indexed repository code did not find Zizmor, axe-core, MSW or Gitleaks. This does **not** prove there are no external organization-level integrations.

## Phase A: security baseline (this draft)

Run `bash scripts/rand-security-audit.sh` **only** in an isolated, authorized checkout after installing verified, version-pinned `zizmor` and `gitleaks` CLI binaries. The script does not install software or change code; reports are saved to a permission-restricted temporary folder and are **not uploaded**.

- Zizmor: assess GitHub Actions injection, token permissions, pinning, OIDC scope, and credential persistence.
- Gitleaks CLI: scan Git history and worktree, redact matches in reports. Findings involving real secrets require credential rotation and an incident assessment; deleting a later commit is insufficient.
- Keep this phase nonblocking. Review severity and false positives before proposing enforcement in CI.
- Security baseline is **not complete** until both CLIs run successfully and findings are triaged.

## Phase B: MSW (not yet installed)

Add MSW as a **devDependency**, update `package-lock.json` with npm 24-compatible tooling and use Node-side interception only for isolated API tests. Reuse `test:chaos` and authentication tests. Cover HTTP 401, 403, 429, 500, network timeout, concurrent refresh, retry, and recovery. Do not register MSW Service Worker in the shipped PWA or intercept real production endpoints. Validate against Supabase integration separately; mocks do not prove backend correctness.

## Phase C: axe-core (not yet installed)

Use `@axe-core/playwright` or an equivalently reviewed integration in a **separate** browser audit of the existing login shell, settings, and authenticated UI where test fixtures exist. Test Chromium and WebKit with desktop and mobile viewport sizes. Report violations with selector, impact, and affected page; do not silently alter approved UI or fail all historical tests on the first audit.

## Gates before requesting merge

1. Confirm baseline CI failures and compare against the branch, especially JWT, mobile and PWA.
2. Pin tool versions and review license/security advisories; review lockfile diffs.
3. Verify no secrets in logs/artifacts and no unauthorized external network transmission.
4. Run quality, chaos, auth, browser and freeze gates; distinguish pre-existing failures from regressions.
5. Obtain explicit approval before any merge or deploy. Do not auto-merge.

## Decision log

- Zizmor: **AGGIUNGI** (local opt-in scanner scaffold in this branch).
- Gitleaks CLI: **AGGIUNGI** (local opt-in scanner scaffold in this branch).
- MSW: **AGGIUNGI**, implementation pending dependency/lockfile validation.
- axe-core: **AGGIUNGI**, implementation pending dependency/lockfile validation.
- **SOSTITUISCI**: none.
