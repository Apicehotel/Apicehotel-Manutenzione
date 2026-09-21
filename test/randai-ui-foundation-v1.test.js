import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  RANDAI_SURFACES,
  RANDAI_UI_PRIMITIVES,
  RANDAI_UI_SOURCES,
  assertRandAIPrimitive,
  resolveRandAISurface,
} from '../src/randai/ui/ai-surface-contract.js'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI UI foundation keeps RandUI as the only canonical visual owner', () => {
  assert.equal(RANDAI_UI_SOURCES.canonicalOwner, 'RandUI')
  assert.equal(RANDAI_UI_SOURCES.runtimeStack, 'React 19 + Vite 7')
  assert.deepEqual(RANDAI_UI_PRIMITIVES, [
    'conversation', 'message', 'source', 'status', 'reasoning', 'plan', 'tool', 'composer',
  ])
  for (const primitive of RANDAI_UI_PRIMITIVES) assert.equal(assertRandAIPrimitive(primitive), primitive)
  assert.throws(() => assertRandAIPrimitive('second-design-system'), { code: 'RANDAI_UI_UNKNOWN_PRIMITIVE' })
})

test('dedicated chat page and full RandAI control center remain separate surfaces', () => {
  const main = read('src/main.jsx')
  const shell = read('src/randapp/Shell.jsx')
  assert.equal(resolveRandAISurface(), RANDAI_SURFACES.CHAT_PAGE)
  assert.equal(resolveRandAISurface({ fullPage: true }), RANDAI_SURFACES.CONTROL_CENTER)
  assert.match(shell, /RandAIAssistant/)
  assert.match(shell, /variant="page"/)
  assert.match(main, /RandAIProtectedRoute/)
  assert.match(main, /randaiConsoleMatch/)
})

test('external UI repositories stay governed pattern sources instead of runtime owners', () => {
  const decisions = Object.fromEntries(RANDAI_UI_SOURCES.externalPatterns.map((item) => [item.name, item.decision]))
  assert.equal(decisions['vercel/ai-elements'], 'ADOPT_PATTERN')
  assert.equal(decisions['crafter-station/elements'], 'SOURCE_ONLY')
  assert.equal(decisions['fantastic-admin/basic'], 'LAYOUT_REFERENCE')
  assert.equal(decisions['abuanwar072/E-commerce-Complete-Flutter-UI'], 'MOBILE_REFERENCE')

  const pkg = JSON.parse(read('package.json'))
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const forbiddenRuntimeOwners = ['tailwindcss', '@tailwindcss/vite', 'shadcn', 'ai-elements']
  for (const dependency of forbiddenRuntimeOwners) {
    assert.equal(allDeps[dependency], undefined, `${dependency} cannot enter RandAI without an explicit architecture migration`)
  }
})

test('RandUI v2 preview is retained while Ocean preview still references it', () => {
  const main = read('src/main.jsx')
  assert.match(main, /randapp\/randui-v2\/Preview\.jsx/)
  assert.match(main, /\/ui-v2-preview/)
})
