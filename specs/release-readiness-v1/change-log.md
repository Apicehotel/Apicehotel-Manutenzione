# CHANGE LOG: release-readiness-v1

## Changes
- Restored the release-readiness gate on the active consolidated workstream.
- Split evidence into web baseline and Android-specific signed-package/real-device requirements.
- Reused existing Playwright/device acceptance instead of introducing duplicate tooling.
- Kept signing secrets and store publication outside the repository and behind human release review.
