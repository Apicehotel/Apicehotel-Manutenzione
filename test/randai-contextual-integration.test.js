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

test('the global insert launcher exposes RandAI as a contextual action', async () => {
  const launcher = await source('src/randapp/InsertLauncher.jsx')
  assert.match(launcher, /id:\s*'randai'/)
  assert.match(launcher, /Chiedi a RandAI/)
  assert.match(launcher, /randai-toggle/)
  assert.match(launcher, /contesto della schermata/)
})

test('guidance backend consumes the published operational context', async () => {
  const data = await source('src/randai/randai-data.js')
  assert.match(data, /operationalContext\s*\|\|\s*getRandAIContext\(\)/)
  assert.match(data, /context,\s*\n\s*}/)
})
