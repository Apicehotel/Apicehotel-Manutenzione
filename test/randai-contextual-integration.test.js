import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI contextual bridge stays global while assistant renders inside RandAI page', async () => {
  const main = await source('src/main.jsx')
  const page = await source('src/randapp/RandAIPage.jsx')
  assert.match(main, /RandAIContextBridge/)
  assert.match(main, /<RandAIContextBridge\s*\/>/)
  assert.doesNotMatch(main, /<RandAIAssistant\s*\/>/)
  assert.match(page, /<RandAIAssistant embedded\s*\/>/)
})

test('context bridge publishes hotel actor and active screen without overwriting an issue resource', async () => {
  const bridge = await source('src/randai/context/RandAIContextBridge.jsx')
  assert.match(bridge, /createRandAIContextEnvelope/)
  assert.match(bridge, /current\?\.resource/)
  assert.match(bridge, /hotelId:\s*session\.hotelId/)
  assert.match(bridge, /userId:\s*session\.userId/)
  assert.match(bridge, /aria-current/)
})

test('RandAI stays a dedicated bottom page and is not mixed into contextual creation', async () => {
  const launcher = await source('src/randapp/InsertLauncher.jsx')
  const shell = await source('src/randapp/Shell.jsx')
  const navigation = await source('src/randapp/shell-navigation.js')
  const actions = await source('src/randapp/contextual-add.js')
  assert.doesNotMatch(launcher, /Chiedi a RandAI/)
  assert.doesNotMatch(actions, /id:\s*'randai'/)
  assert.match(navigation, /id:\s*'randai'.*label:\s*'RandAI'/s)
  assert.match(shell, /view === 'randai'[\s\S]*<RandAIPage/)
  assert.doesNotMatch(shell, /header-randai/)
})

test('guidance backend consumes the published operational context', async () => {
  const data = await source('src/randai/randai-data.js')
  assert.match(data, /operationalContext\s*\|\|\s*getRandAIContext\(\)/)
  assert.match(data, /context,\s*\n\s*}/)
})


test('embedded RandAI workspace stays structure-agnostic and page-native', async () => {
  const assistant = await source('src/randai/RandAIAssistant.jsx')
  const css = await source('src/randai/randai.css')
  const page = await source('src/randapp/RandAIPage.jsx')
  assert.match(assistant, /randai__embedded-toolbar/)
  assert.match(assistant, /randai__quick-grid/)
  assert.match(assistant, /Priorità adesso/)
  assert.match(assistant, /Cosa è cambiato/)
  assert.doesNotMatch(assistant, /Prova: camera 125 non fredda/)
  assert.doesNotMatch(assistant, /placeholder="Es\. Camera 125 non fredda/)
  assert.match(css, /first-class intelligence workspace/)
  assert.match(assistant, /className="randai-page-workspace"/)
  assert.doesNotMatch(assistant, /randai--embedded/)
  assert.doesNotMatch(assistant, /<section className="randai__panel" role=\{embedded/)
  assert.match(page, /title="RandAI"/)
})
