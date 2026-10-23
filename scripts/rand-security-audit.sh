#!/usr/bin/env bash
# Read-only, opt-in security audit. No package installation or Git writes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -d .git ]]; then
  echo "Run this script from a Git checkout." >&2
  exit 2
fi

missing=0
for binary in zizmor gitleaks; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Missing required CLI: $binary (install a vetted, pinned release separately)." >&2
    missing=1
  fi
done
if (( missing )); then exit 2; fi

# Private temporary reports; never upload raw findings to public CI artifacts.
umask 077
REPORT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rand-security-audit.XXXXXXXX")"
trap 'echo "Local reports: $REPORT_DIR (inspect securely; delete when finished)"' EXIT
echo "Scanning GitHub Actions with zizmor..."
set +e
zizmor --format json .github/workflows > "$REPORT_DIR/zizmor.json"
zizmor_status=$?
echo "Scanning Git history and worktree with Gitleaks..."
gitleaks git --redact --report-format json --report-path "$REPORT_DIR/gitleaks.json" .
gitleaks_status=$?
set -e
printf 'zizmor exit=%s; gitleaks exit=%s\n' "$zizmor_status" "$gitleaks_status"
if (( zizmor_status != 0 || gitleaks_status != 0 )); then
  echo "Audit reported findings or an execution error; review both local reports before deciding." >&2
  exit 1
fi
echo "Both security scans completed without reported failures."
