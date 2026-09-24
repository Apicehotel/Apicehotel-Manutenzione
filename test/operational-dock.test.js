import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const detail = read('src/randapp/OperationalDetailPage.jsx')
const css = read('src/randapp/operational-detail.css')
const issues = read('src/randapp/Issues.jsx')
const interventions = read('src/randapp/operations/InterventionsView.jsx')

test('Operational Dock keeps Back stable and accepts one domain-owned primary action', () => {
  assert.match(detail, /export function OperationalDock/)
  assert.match(detail, /data-testid="operational-dock"/)
  assert.match(detail, /data-testid="operational-detail-back">Indietro<\/Button>/)
  assert.match(detail, /data-testid="operational-primary-action"/)
  assert.match(detail, /primaryAction\.busy/)
  assert.match(detail, /primaryAction\.disabled/)
})

test('Dock is thumb-friendly on mobile and restrained on desktop', () => {
  assert.match(css, /\.rs-operational-dock\s*\{[^}]*grid-template-columns:/s)
  assert.match(css, /min-height:\s*var\(--rs-control-h-lg\)/)
  assert.match(css, /\.rs-operational-dock > \.rs-btn:only-child/)
  assert.match(css, /@media \(min-width:\s*900px\)[\s\S]*\.rs-operational-dock/s)
  assert.match(css, /var\(--rs-adaptive-safe-bottom, 0px\)/)
})

test('Issues choose one contextual primary action and do not duplicate it in the body', () => {
  const detailBlock = issues.slice(issues.indexOf('function IssueDetail'), issues.indexOf('export default function Issues'))
  assert.match(detailBlock, /const primaryAction = \(\(\) =>/)
  assert.match(detailBlock, /label: 'Pezzo arrivato'/)
  assert.match(detailBlock, /label: 'Segna completata'/)
  assert.match(detailBlock, /label: 'Riparazione completata'/)
  assert.match(detailBlock, /primaryAction=\{primaryAction\}/)
  assert.equal((detailBlock.match(/>Riparazione completata<\/Button>/g) || []).length, 0)
  assert.equal((detailBlock.match(/>Pezzo arrivato, torna in Da fare<\/Button>/g) || []).length, 0)
  assert.equal((detailBlock.match(/>Segna completata \(tecnico\)<\/Button>/g) || []).length, 0)
})

test('Interventions move completion to Dock and preserve pending-parts and busy gates', () => {
  const block = interventions.slice(interventions.indexOf('function PlannedDetail'))
  assert.match(block, /const primaryAction = canComplete \? \{ label: 'Segna completato'/)
  assert.match(block, /disabled: partsPending/)
  assert.match(block, /busy, busyLabel: 'Salvataggio…'/)
  assert.match(block, /primaryAction=\{primaryAction\}/)
  assert.equal((block.match(/>Segna completato<\/Button>/g) || []).length, 0)
})
