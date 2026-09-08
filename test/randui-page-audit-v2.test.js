import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { RANDUI_MIGRATED_PAGE_IDS } from '../src/randapp/randui/page-catalog.js'
import {
  RANDUI_PAGE_AUDIT,
  RANDUI_PAGE_AUDIT_VERSION,
  listRandUiPageAudit,
  summarizeRandUiPageAudit,
} from '../src/randapp/randui/page-audit.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Point 2 audits the complete canonical 24-page inventory', () => {
  assert.equal(RANDUI_PAGE_AUDIT_VERSION, 'page-audit-v2')
  assert.equal(RANDUI_MIGRATED_PAGE_IDS.length, 24)
  assert.equal(listRandUiPageAudit().length, 24)
  assert.deepEqual(Object.keys(RANDUI_PAGE_AUDIT).sort(), [...RANDUI_MIGRATED_PAGE_IDS].sort())
})

test('every audited page has a bounded decision, priority and canonical template metadata', () => {
  for (const row of listRandUiPageAudit()) {
    assert.ok(['KEEP', 'ALIGN', 'REWORK'].includes(row.decision), row.id)
    assert.ok(['P0', 'P1', 'P2'].includes(row.priority), row.id)
    assert.ok(row.domain, row.id)
    assert.ok(row.pageType, row.id)
    assert.ok(row.focus.length >= 12, row.id)
  }
})

test('audit produces a finite roadmap instead of redesigning all pages from zero', () => {
  const summary = summarizeRandUiPageAudit()
  assert.deepEqual(summary, { total: 24, KEEP: 4, ALIGN: 18, REWORK: 2, P0: 2, P1: 18, P2: 4 })
  assert.equal(RANDUI_PAGE_AUDIT.temperature.decision, 'REWORK')
  assert.equal(RANDUI_PAGE_AUDIT.plants.decision, 'REWORK')
  assert.equal(RANDUI_PAGE_AUDIT.profile.decision, 'KEEP')
  assert.equal(RANDUI_PAGE_AUDIT['desktop-download'].decision, 'KEEP')
})

test('Point 2 keeps visual validation on Ocean and does not create a second design system', () => {
  const readme = read('../README.md')
  const source = read('../src/randapp/randui/page-audit.js')
  assert.match(readme, /prove e test grafici della nuova UI vanno esclusivamente su DigitalOcean\/Ocean/)
  assert.doesNotMatch(source, /@mui|antd|chakra|bootstrap|styled-components/)
  assert.match(source, /resolveRandUiTemplate/)
})
