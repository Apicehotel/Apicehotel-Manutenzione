import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflow = fs.readFileSync(new URL('../.github/workflows/digitalocean-preview.yml', import.meta.url), 'utf8')

test('PRs verify only while main or an intentional dispatch owns Ocean', () => {
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/)
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /PREVIEW_REF: \$\{\{ github\.event\.pull_request\.head\.sha \|\| inputs\.ref \|\| github\.sha \}\}/)
  assert.match(workflow, /ref: \$\{\{ env\.PREVIEW_REF \}\}/)
  assert.match(workflow, /npm run test:matrix/)
  assert.match(workflow, /npm run test:critical/)
  assert.match(workflow, /npm run test:randui/)
  assert.match(workflow, /node scripts\/check-bundle\.mjs/)
  assert.match(workflow, /if: \(github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\) \|\| github\.event_name == 'workflow_dispatch'/)
  assert.doesNotMatch(workflow, /if:.*github\.event_name == 'pull_request'.*Deploy/s)
  assert.match(workflow, /digitalocean\/app_action\/deploy@v2/)
})

test('Ocean workflow stays Vercel-free and main becomes the stable automatic deploy source', () => {
  assert.doesNotMatch(workflow, /vercel/i)
  assert.match(workflow, /OCEAN_GITHUB_BRANCH: \$\{\{ github\.event_name == 'push' && 'main' \|\| inputs\.ref \|\| 'main' \}\}/)
  assert.match(workflow, /environment: preview/)
})
