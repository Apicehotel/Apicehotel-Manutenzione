import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflow = fs.readFileSync(new URL('../.github/workflows/digitalocean-preview.yml', import.meta.url), 'utf8')

test('RandUI preview deploys the PR head/requested ref to Ocean only after quality gates', () => {
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /PREVIEW_REF: \$\{\{ github\.event\.pull_request\.head\.sha \|\| inputs\.ref \}\}/)
  assert.match(workflow, /ref: \$\{\{ env\.PREVIEW_REF \}\}/)
  assert.match(workflow, /npm run test:matrix/)
  assert.match(workflow, /npm run test:critical/)
  assert.match(workflow, /npm run test:randui/)
  assert.match(workflow, /node scripts\/check-bundle\.mjs/)
  assert.match(workflow, /digitalocean\/app_action\/deploy@v2/)
})

test('RandUI preview does not hardcode main checkout or touch Vercel', () => {
  assert.doesNotMatch(workflow, /ref:\s*main/)
  assert.doesNotMatch(workflow, /vercel/i)
  assert.match(workflow, /environment: preview/)
})
