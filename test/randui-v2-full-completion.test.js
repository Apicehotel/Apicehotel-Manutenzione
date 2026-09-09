import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { RANDUI_PAGE_CATALOG } from '../src/randapp/randui/page-catalog.js'
import { listRandUiTemplates } from '../src/randapp/randui/template-registry.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('RandUI v2 completion remains global for all 24 catalogued pages', () => {
  assert.equal(Object.keys(RANDUI_PAGE_CATALOG).length, 24)
  assert.equal(listRandUiTemplates().length, 14)

  const foundation = read('../src/randapp/randui/foundation.css')
  const completion = read('../src/randapp/randui/completion-v2.css')
  const visualImport = foundation.indexOf("@import './visual-language.css';")
  const completionImport = foundation.indexOf("@import './completion-v2.css';")

  assert.ok(visualImport >= 0, 'visual language import missing')
  assert.ok(completionImport > visualImport, 'completion layer must load after visual language')
  assert.match(completion, /\.rs-randui-page--migrated/)
  assert.match(completion, /@media \(max-width: 767px\)/)
  assert.match(completion, /@media \(min-width: 768px\) and \(max-width: 1199px\)/)
  assert.match(completion, /@media \(min-width: 1200px\)/)
  assert.match(completion, /html\[data-ui-size='large'\]/)
})

test('completion layer fixes overflow and vertical dead-space without viewport hacks', () => {
  const completion = read('../src/randapp/randui/completion-v2.css')
  assert.match(completion, /align-content: start/)
  assert.match(completion, /min-height: 0/)
  assert.match(completion, /overflow-x: auto/)
  assert.match(completion, /overscroll-behavior-x: contain/)
  assert.match(completion, /max-width: 100%/)
  assert.doesNotMatch(completion, /100vw/)
  assert.doesNotMatch(completion, /min-height:\s*(?:[3-9]\d\d|\d{4,})px/)
})

test('mobile actions and controls reflow instead of clipping', () => {
  const completion = read('../src/randapp/randui/completion-v2.css')
  assert.match(completion, /flex-direction: column/)
  assert.match(completion, /flex: 1 1 140px/)
  assert.match(completion, /flex-basis: 100%/)
  assert.match(completion, /var\(--rs-adaptive-touch-min\)/)
})

test('completion layer stays dependency-free and does not create a second design system', () => {
  const completion = read('../src/randapp/randui/completion-v2.css')
  assert.doesNotMatch(completion, /@mui|antd|chakra|bootstrap|tailwind|styled-components/i)
  assert.doesNotMatch(completion, /!important/)
})
