import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI contextual bridge is mounted only with an authenticated assistant', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /RandAIContextBridge/)
  assert.match(main, /<RandAIContextBridge\s*\/><RandAIAssistant\s*\/>/)
})

test('context bridge publishes hotel actor and active screen without overwriting an issue resource', async () => {
  const bridge = await source('src/randai/context/RandAIContextBridge.jsx')
  assert.match(bridge, /createRandAIContextEnvelope/)
  assert.match(bridge, /current\?\.resource/)
  assert.match(bridge, /hotelId:\s*session\.hotelId/)
  assert.match(bridge, /userId:\s*session\.userId/)
  assert.match(bridge, /aria-current/)
})

test('RandAI stays a dedicated header action and is not mixed into contextual creation', async () => {
  const launcher = await source('src/randapp/InsertLauncher.jsx')
  const shell = await source('src/randapp/Shell.jsx')
  const actions = await source('src/randapp/contextual-add.js')
  assert.doesNotMatch(launcher, /Chiedi a RandAI/)
  assert.doesNotMatch(actions, /id:\s*'randai'/)
  assert.match(shell, /data-testid="header-randai"/)
  assert.match(shell, /randai-toggle/)
})

test('guidance backend consumes the published operational context', async () => {
  const data = await source('src/randai/randai-data.js')
  assert.match(data, /operationalContext\s*\|\|\s*getRandAIContext\(\)/)
  assert.match(data, /context,\s*\n\s*}/)
})
