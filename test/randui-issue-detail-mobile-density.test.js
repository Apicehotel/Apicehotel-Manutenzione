import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile compact issue detail is scoped and does not alter other operational screens', async () => {
  const css = await read('src/randapp/operational-detail.css')
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /\.rs-issue-detail \.rs-meta-grid > div\s*\{[^}]*display:\s*flex/s)
  assert.match(css, /\.rs-issue-detail \.rs-operational-detail__head p\s*\{\s*display:\s*none/s)
  assert.match(css, /\.rs-issue-detail \.rs-operational-timeline__event img\s*\{[^}]*max-height:\s*280px/s)
  assert.match(css, /\.rs-operational-dock > \.rs-btn\s*\{[^}]*min-height:\s*var\(--rs-control-h-lg\)/s)
})

test('issue detail keeps its operative actions, image and timeline', async () => {
  const issue = await read('src/randapp/Issues.jsx')
  for (const contract of ['<OperationalTimeline events={timelineEvents}', '<RandAISuggestion issue={issue}', "Riparazione completata", "Aggiungi foto completamento", "Chiedi un tecnico"]) assert.ok(issue.includes(contract), contract)
})

test('documentation tracks the mobile detail density contract', async () => {
  const doc = await read('FRONTEND_ARCHITECTURE.md')
  assert.match(doc, /Densità dettagli operativi su smartphone/)
})

test('iPhone notch stays clear in Focus Mode header and fixed menu', async () => {
  const css = await read('src/randapp/operational-detail.css')
  assert.match(css, /--rs-focus-safe-top:\s*max\(var\(--rs-adaptive-safe-top, 0px\), env\(safe-area-inset-top, 0px\)\)/)
  assert.match(css, /\.rs-operational-detail__head\s*\{[^}]*var\(--rs-focus-safe-top\)/s)
  assert.match(css, /\.rs-operational-menu-trigger\s*\{[^}]*env\(safe-area-inset-top, 0px\)/s)
})
