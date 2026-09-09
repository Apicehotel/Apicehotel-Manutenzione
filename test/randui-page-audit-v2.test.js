import test from 'node:test'
import assert from 'node:assert/strict'
import { RANDUI_PAGE_CATALOG } from '../src/randapp/randui/page-catalog.js'
import { RANDUI_PAGE_AUDIT_V2, RANDUI_AUDIT_STATUS, auditRandUiPageCoverage } from '../src/randapp/randui/page-audit-v2.js'

test('Point 2 audit covers all 24 RandUI pages exactly once', () => {
  const coverage = auditRandUiPageCoverage()
  assert.equal(Object.keys(RANDUI_PAGE_CATALOG).length, 24)
  assert.equal(Object.keys(RANDUI_PAGE_AUDIT_V2).length, 24)
  assert.equal(coverage.complete, true)
})

test('known field findings stay encoded in the audit', () => {
  assert.equal(RANDUI_PAGE_AUDIT_V2.temperature.status, RANDUI_AUDIT_STATUS.REBUILD)
  assert.equal(RANDUI_PAGE_AUDIT_V2.temperature.priority, 'critical')
  assert.equal(RANDUI_PAGE_AUDIT_V2.plants.status, RANDUI_AUDIT_STATUS.KEEP)
  assert.equal(RANDUI_PAGE_AUDIT_V2.operations.status, RANDUI_AUDIT_STATUS.UNIFY)
  assert.equal(RANDUI_PAGE_AUDIT_V2['planning-work'].status, RANDUI_AUDIT_STATUS.UNIFY)
  assert.equal(RANDUI_PAGE_AUDIT_V2.inventory.status, RANDUI_AUDIT_STATUS.UNIFY)
})

test('every audit entry has priority and evidence notes', () => {
  for (const [id, entry] of Object.entries(RANDUI_PAGE_AUDIT_V2)) {
    assert.ok(['keep','unify','rebuild'].includes(entry.status), `${id}: invalid status`)
    assert.ok(['low','medium','high','critical'].includes(entry.priority), `${id}: invalid priority`)
    assert.ok(entry.notes.length > 0, `${id}: missing notes`)
  }
})
