import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Home puts the operational queue before RandAI recommendation', async () => {
  const home = await read('src/randapp/Home.jsx')
  const queueHeading = home.indexOf('<h2>Cosa fare adesso</h2>')
  const randai = home.indexOf('<RandAIPriorityCard')
  assert.ok(queueHeading >= 0)
  assert.ok(randai >= 0)
  assert.ok(queueHeading < randai)
})

test('Home exposes stat count so three operational counters can stay on one mobile row', async () => {
  const home = await read('src/randapp/Home.jsx')
  const css = await read('src/randapp/home-operational.css')
  assert.match(home, /data-count=\{stats\.length\}/)
  assert.match(css, /\.rs-workhome__stats\[data-count='3'\]\s*\{\s*grid-template-columns:\s*repeat\(3,/)
})

test('Home distinguishes urgent alerts from high-priority issues', async () => {
  const home = await read('src/randapp/Home.jsx')
  assert.match(home, /label:'Allarmi'/)
  assert.match(home, /eyebrow:'Allarme'/)
  assert.match(home, /item\.urgency === 'alta' \? 92/)
})

test('Home replaces floating create overlap with an explicit authorized new-issue action', async () => {
  const home = await read('src/randapp/Home.jsx')
  const css = await read('src/randapp/home-operational.css')
  assert.match(home, /canCreateIssues&&<Button[\s\S]*onNavigate\?\.\('new-issue'\)/)
  assert.match(home, /aria-label="Nuova segnalazione"/)
  assert.match(css, /\.rs-app:has\(\.rs-workhome\) \.rs-navfab \{ display: none; \}/)
})

test('Home density keeps Piccolo Normale Grande compatible', async () => {
  const css = await read('src/randapp/home-operational.css')
  assert.match(css, /html\[data-ui-size='large'\] \.rs-workhome__stat/)
  assert.match(css, /html\[data-ui-size='large'\] \.rs-workhome__task/)
  assert.match(css, /@media \(max-width: 520px\)/)
})

test('RandAI score is self-explanatory and component no longer owns inline CSS', async () => {
  const card = await read('src/randapp/RandAIPriorityCard.jsx')
  const css = await read('src/randapp/home-operational.css')
  assert.match(card, /Priorità \{item\.score\}/)
  assert.doesNotMatch(card, /<style>/)
  assert.match(css, /\.rs-randai-priority__score/)
})

test('Home component uses one canonical external stylesheet instead of embedded HOME13 styles', async () => {
  const home = await read('src/randapp/Home.jsx')
  assert.match(home, /import ['"]\.\/home-operational\.css['"]/)
  assert.doesNotMatch(home, /HOME13_STYLES/)
  assert.doesNotMatch(home, /<style>/)
})
