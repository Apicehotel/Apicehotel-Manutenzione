import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const workflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const matrix = JSON.parse(fs.readFileSync(new URL('./quality-matrix.json', import.meta.url), 'utf8'))
const criticalRunner = fs.readFileSync(new URL('../scripts/run-critical-tests.mjs', import.meta.url), 'utf8')

test('point 14 exposes explicit quality, contract and browser gates', () => {
  assert.equal(pkg.scripts['test:matrix'], 'node scripts/check-quality-matrix.mjs')
  assert.equal(pkg.scripts['test:critical'], 'node scripts/run-critical-tests.mjs')
  assert.equal(pkg.scripts['test:e2e'], 'node test/e2e.mjs')

  assert.match(workflow, /Quality matrix[\s\S]*npm run test:matrix/)
  assert.match(workflow, /Critical operational gate[\s\S]*npm run test:critical/)
  assert.match(workflow, /Multi-hotel parity gate[\s\S]*npm run test:multihotel/)

  assert.match(workflow, /RandAI Point 3 behavior contracts[\s\S]*node --test test\/randai-issue-operations\.test\.js/)
  assert.match(workflow, /RandAI legacy and platform contracts[\s\S]*find test -maxdepth 1 -name 'randai-\*\.test\.js'/)

  // Shared contracts may be executed as one Node test command or isolated one-by-one
  // for diagnostics, but the complete non-RandAI partition must remain fail-closed.
  assert.match(workflow, /RandApp and shared contracts[\s\S]*find test -maxdepth 1 -name '\*\.test\.js' ! -name 'randai-\*\.test\.js'/)
  assert.match(workflow, /RandApp and shared contracts[\s\S]*node --test/)
  assert.match(workflow, /shared-contract-failures|exit 1/)

  assert.match(workflow, /Install Playwright Chromium and WebKit[\s\S]*playwright install --with-deps chromium webkit/)
  assert.match(workflow, /Cross-platform browser gate[\s\S]*npm run test:e2e/)
  assert.match(workflow, /Device acceptance gate[\s\S]*npm run test:device/)
})

test('point 14 matrix covers all hotels, platforms and network states', () => {
  assert.deepEqual(new Set(matrix.hotels), new Set(['hotelgio','chocohotel','brigantino']))
  assert.ok(matrix.platforms.includes('ios-webkit'))
  assert.ok(matrix.platforms.includes('android-chromium'))
  assert.ok(matrix.platforms.includes('windows-chromium'))
  for (const state of ['online','offline','reconnect']) assert.ok(matrix.networkStates.includes(state))
})

test('point 14 critical risks cannot silently disappear', () => {
  const ids = new Set(matrix.criticalRisks.map((risk) => risk.id))
  for (const id of ['auth-session','permissions','hotel-isolation','maintenance-lifecycle','offline-sync','housekeeping','notifications','work-home','pwa-platform','weather-operations','diagnostics-recovery','database-security']) assert.ok(ids.has(id), `missing ${id}`)
  for (const risk of matrix.criticalRisks) assert.ok(risk.tests.length > 0, `${risk.id} needs tests`)
})

test('point 14 critical runner includes high-risk production contracts', () => {
  for (const file of ['point5-operational.test.js','point6-resilience.test.js','point8-security.test.js','point10-housekeeping.test.js','point11-multihotel.test.js','point17-database-security.test.js','offline-resilience-v2.test.js','push-multihotel.test.js','pwa.test.js']) assert.match(criticalRunner, new RegExp(file.replaceAll('.', '\\.')))
})
