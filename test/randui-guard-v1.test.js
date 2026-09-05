import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { RANDUI_DESIGN_CONTRACT } from '../src/randapp/randui/design-contract.js'
import {
  RANDUI_GUARD_VIEWPORTS,
  RANDUI_TOUCH_TARGET_MIN,
  assertRandUiComposition,
  assertRandUiGeometry,
  auditRandUiComposition,
  auditRandUiGeometry,
} from '../src/randapp/randui/guard.js'
import { resolveRandUiPage } from '../src/randapp/randui/page-schema.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('RandUI Guard owns the canonical responsive acceptance matrix', () => {
  assert.deepEqual(RANDUI_GUARD_VIEWPORTS.map(({ width }) => width), [320, 375, 390, 430, 768, 1024, 1440])
  assert.equal(RANDUI_TOUCH_TARGET_MIN, 44)
  assert.equal(RANDUI_DESIGN_CONTRACT.layerOwners.guard, 'src/randapp/randui/guard.js')
})

test('composition guard rejects unknown components, forbidden components and undeclared slots', () => {
  const schema = { id:'housekeeping', pageType:'operational' }
  assert.equal(assertRandUiComposition(schema, { components:['Card','Button'], slots:['header','work','actions'] }), true)
  assert.deepEqual(auditRandUiComposition(schema, { components:['ThemeControl'] }).map((item) => item.code), ['component-not-allowed'])
  assert.deepEqual(auditRandUiComposition(schema, { components:['MadeUpWidget'] }).map((item) => item.code), ['unregistered-component'])
  assert.deepEqual(auditRandUiComposition(schema, { slots:['invented-slot'] }).map((item) => item.code), ['slot-not-allowed'])
  assert.throws(() => resolveRandUiPage({ id:'bad-slots', pageType:'operational', slots:{ invented:true } }), /Unknown slots/)
})

test('geometry guard fails closed on overflow, viewport escape, undersized actions, unnamed actions and duplicate ids', () => {
  const broken = auditRandUiGeometry({
    viewportWidth: 390,
    documentWidth: 420,
    nodes:[
      { subject:'panel', visible:true, left:0, right:410, width:410, height:100 },
      { subject:'icon-button', visible:true, actionable:true, left:10, right:42, width:32, height:32, accessibleName:'' },
    ],
    templates:[{ id:'not-real', h1Count:2 }],
    duplicateIds:['settings-panel'],
  })
  const codes = broken.map((item) => item.code)
  for (const code of ['horizontal-overflow','viewport-escape','touch-target','accessible-name','unknown-template','multiple-h1','duplicate-id']) assert.ok(codes.includes(code), `${code} not detected`)
  assert.throws(() => assertRandUiGeometry({ viewportWidth:390, documentWidth:420 }), /layout guard failed/)
})

test('geometry guard accepts bounded, accessible RandUI geometry', () => {
  assert.equal(assertRandUiGeometry({
    viewportWidth: 390,
    documentWidth: 390,
    nodes:[{ subject:'primary-action', visible:true, actionable:true, left:12, right:112, width:100, height:44, accessibleName:'Salva' }],
    templates:[{ id:'form', h1Count:1 }],
    duplicateIds:[],
  }), true)
})

test('foundation carries defensive layout primitives and bans 100vw page ownership', () => {
  const foundation = read('../src/randapp/randui/foundation.css')
  assert.match(foundation, /min-width:\s*0/)
  assert.match(foundation, /max-width:\s*100%/)
  assert.match(foundation, /minmax\(0,\s*1fr\)/)
  assert.doesNotMatch(foundation, /width:\s*100vw/)
})

test('browser quality gate is wired to RandUI Guard and all acceptance widths', () => {
  const e2e = read('./e2e.mjs')
  assert.match(e2e, /RANDUI_GUARD_VIEWPORTS/)
  assert.match(e2e, /assertRandUiLayoutGuard/)
  assert.match(e2e, /data-randui-template/)
  assert.match(e2e, /duplicateIds/)
})
