import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildPrimaryBottomNav } from '../src/randapp/shell-navigation.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Fase 2: RandChat resta fuori dalla navbar primaria per ogni profilo', () => {
  const placement = () => 'bottom'
  const allowed = () => true
  const nav = buildPrimaryBottomNav({ placement, viewAllowed: allowed })
  assert.equal(nav.length, 5)
  assert.equal(nav.some((item) => item.id === 'chat'), false)
  assert.deepEqual(nav.map((item) => item.slot), [1, 2, 3, 4, 5])
  assert.equal(nav[0].label, 'Operatività')
  assert.equal(nav[1].label, 'Planning')
  assert.equal(nav[2].label, 'Home')
  assert.equal(nav[4].label, 'RandAI')
})

test('Fase 2: il layout mobile mantiene safe-area e spazio per la navbar fissa', () => {
  const css = read('../src/randapp/adaptive-layout.css')
  assert.match(css, /--rs-adaptive-safe-bottom:\s*max\(env\(safe-area-inset-bottom/)
  assert.match(css, /padding-bottom:\s*calc\(var\(--rs-nav-h\) \+ var\(--rs-adaptive-safe-bottom\)/)
  assert.match(css, /\.rs-bottomnav[\s\S]*grid-template-columns:\s*repeat\(5,/) 
})

test('Fase 2: Chat resta comunque disponibile nel menu completo', () => {
  const nav = read('../src/randapp/nav.js')
  assert.match(nav, /id: 'chat', icon: 'message', label: 'RandChat'/)
})
