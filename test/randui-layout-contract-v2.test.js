import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RANDUI_PAGE_CATALOG } from '../src/randapp/randui/page-catalog.js'
import { RANDUI_TEMPLATE_REGISTRY } from '../src/randapp/randui/template-registry.js'
import { RANDUI_LAYOUT_CONTRACT_VERSION, RANDUI_LAYOUT_VIEWPORTS, auditRandUiLayoutCatalog, resolveRandUiLayout } from '../src/randapp/randui/layout-contract.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Point 2 binds all 24 pages to one measurable layout contract', () => {
  assert.equal(RANDUI_LAYOUT_CONTRACT_VERSION, '2.0.0')
  assert.equal(Object.keys(RANDUI_PAGE_CATALOG).length, 24)
  assert.deepEqual(RANDUI_LAYOUT_VIEWPORTS, [320,375,390,430,768,1024,1440])
  assert.deepEqual(auditRandUiLayoutCatalog(), [])
  for (const pageId of Object.keys(RANDUI_PAGE_CATALOG)) {
    const layout = resolveRandUiLayout(pageId)
    assert.equal(layout.pageId, pageId)
    assert.ok(RANDUI_TEMPLATE_REGISTRY[layout.templateId])
    assert.ok(layout.widthPolicy.max)
    assert.ok(layout.rhythmPolicy.pageGap)
    assert.ok(layout.responsive.mobile)
    assert.ok(layout.responsive.tablet)
    assert.ok(layout.responsive.desktop)
  }
})

test('layout families keep deliberate width and rhythm instead of per-page magic numbers', () => {
  assert.equal(resolveRandUiLayout('home').rhythm, 'comfortable')
  assert.equal(resolveRandUiLayout('housekeeping').rhythm, 'compact')
  assert.equal(resolveRandUiLayout('planning-work').rhythm, 'compact')
  assert.equal(resolveRandUiLayout('profile').width, 'reading')
  assert.equal(resolveRandUiLayout('desktop-download').width, 'center')
  assert.throws(() => resolveRandUiLayout('zombie-page'), /catalogued page/)
})

test('Unified Page v2 stays a thin boundary layer', () => {
  const boundary = read('../src/randapp/randui/PageBoundary.jsx')
  const css = read('../src/randapp/randui/layout-v2.css')
  assert.match(boundary, /import '\.\/layout-v2\.css'/)
  assert.match(css, /--randui-page-max: var\(--rand-content-max\)/)
  assert.match(css, /data-randui-width='reading'/)
  assert.match(css, /margin-inline: auto/)
  assert.doesNotMatch(css, /\.rs-card|\.rs-page-title|\.rs-bottomnav/)
})

test('Point 2 does not create a second design system', () => {
  const source = read('../src/randapp/randui/layout-contract.js')
  assert.doesNotMatch(source, /@mui|antd|chakra|bootstrap|tailwind|styled-components/)
})
