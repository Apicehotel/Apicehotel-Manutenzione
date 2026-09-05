import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  RANDUI_BREAKPOINTS,
  RANDUI_DESIGN_CONTRACT,
  RANDUI_SYSTEM_STATES,
  RANDUI_TEMPLATE_IDS,
  classifyRandUiViewport,
  normalizeRandUiDensity,
} from '../src/randapp/randui/design-contract.js'
import { RANDUI_COMPONENT_IDS, RANDUI_COMPONENT_REGISTRY, supportsRandUiState } from '../src/randapp/randui/component-registry.js'
import { RANDUI_TEMPLATE_REGISTRY, listRandUiTemplates } from '../src/randapp/randui/template-registry.js'
import { assertRandUiComponentAllowed, resolveRandUiPage } from '../src/randapp/randui/page-schema.js'
import { RANDUI_PAGE_CATALOG } from '../src/randapp/randui/page-catalog.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('RandUI v1 design contract owns canonical breakpoints density templates and states', () => {
  assert.equal(RANDUI_DESIGN_CONTRACT.version, '1.0.0')
  assert.deepEqual(RANDUI_BREAKPOINTS, { mobileMax:767, tabletMin:768, tabletMax:1199, desktopMin:1200 })
  assert.equal(classifyRandUiViewport(767), 'mobile')
  assert.equal(classifyRandUiViewport(768), 'tablet')
  assert.equal(classifyRandUiViewport(1199), 'tablet')
  assert.equal(classifyRandUiViewport(1200), 'desktop')
  assert.equal(normalizeRandUiDensity('large'), 'large')
  assert.equal(normalizeRandUiDensity('giant'), 'normal')
  assert.equal(RANDUI_TEMPLATE_IDS.length, 14)
  assert.equal(RANDUI_SYSTEM_STATES.length, 15)
})

test('component registry is state-aware and keeps canonical primitive sources', () => {
  for (const id of ['Icon','Button','IconButton','Card','Field','TextInput','Badge','Segmented','Spinner','EmptyState','Sheet','Modal','ConfirmDialog','UiSizeControl','ThemeControl']) {
    assert.ok(RANDUI_COMPONENT_IDS.includes(id), `${id} missing from registry`)
    assert.equal(RANDUI_COMPONENT_REGISTRY[id].source, '../ui.jsx')
    assert.ok(RANDUI_COMPONENT_REGISTRY[id].states.length > 0)
  }
  assert.equal(supportsRandUiState('Button','loading'), true)
  assert.equal(supportsRandUiState('Field','error'), true)
  assert.equal(supportsRandUiState('SystemState','offline'), true)
})

test('template registry is complete and references only registered components', () => {
  const templates = listRandUiTemplates()
  assert.equal(templates.length, RANDUI_TEMPLATE_IDS.length)
  for (const template of templates) {
    assert.ok(template.slots.length > 0, `${template.id} has no slots`)
    assert.ok(template.responsive.mobile)
    assert.ok(template.responsive.tablet)
    assert.ok(template.responsive.desktop)
    for (const componentId of template.allowedComponents) assert.ok(RANDUI_COMPONENT_REGISTRY[componentId], `${template.id} references ${componentId}`)
  }
  assert.deepEqual(Object.keys(RANDUI_TEMPLATE_REGISTRY).sort(), [...RANDUI_TEMPLATE_IDS].sort())
})

test('page resolver constrains components and normalizes aliases and density', () => {
  const page = resolveRandUiPage({ id:'hk', domain:'housekeeping', pageType:'operational', density:'giant', permissions:['read','read'] })
  assert.equal(page.pageType, 'operational')
  assert.equal(page.density, 'normal')
  assert.deepEqual(page.permissions, ['read'])
  assert.equal(assertRandUiComponentAllowed({ id:'hk', pageType:'operational' }, 'Card'), true)
  assert.throws(() => assertRandUiComponentAllowed({ id:'hk', pageType:'operational' }, 'ThemeControl'), /not allowed/)
  assert.equal(resolveRandUiPage({ id:'archive', pageType:'archive' }).pageType, 'search-archive')
  assert.throws(() => resolveRandUiPage({ id:'bad', pageType:'invented' }), /Unknown RandUI page type/)
})

test('current product domains have a declared RandUI migration target', () => {
  for (const id of ['home','issues','chat','housekeeping','supplies','interventions','inventory','planning-work','planning-sale','urgent','reminders','temperature','plants','technicians','profile','manual','feedback','settings','randai']) {
    assert.ok(RANDUI_PAGE_CATALOG[id], `${id} has no RandUI schema`)
    assert.ok(RANDUI_TEMPLATE_REGISTRY[RANDUI_PAGE_CATALOG[id].pageType])
  }
})

test('runtime foundation is final and Settings no longer creates a second authenticated chrome', () => {
  const main = read('../src/main.jsx')
  const foundation = read('../src/randapp/randui/foundation.css')
  const shell = read('../src/randapp/Shell.jsx')
  const settings = read('../src/randapp/Settings.jsx')
  assert.ok(main.lastIndexOf("./randapp/randui/foundation.css") > main.lastIndexOf("./randapp/urgent-shell-layout-fix.css"))
  assert.match(foundation, /@import '\.\.\/adaptive-layout\.css'/)
  assert.match(foundation, /@import '\.\.\/ui-coherence\.css'/)
  assert.match(foundation, /min-width: 1024px\) and \(max-width: 1199px/)
  assert.match(foundation, /\.rs-sidebar \{ display: none !important; \}/)
  assert.match(foundation, /\.rs-header \{ display: flex !important;/)
  assert.match(shell, /const renderView = \(\) => \{\s*if \(settings !== null\) return <Settings[^>]* embedded/s)
  assert.doesNotMatch(shell, /if \(settings !== null\) return <Suspense/)
  assert.doesNotMatch(settings, /rs-settings-nav/)
  assert.doesNotMatch(settings, /rs-settings-head/)
  assert.match(settings, /SettingsTemplate/)
})

test('deleted duplicate foundation stays dead and final owners are explicit', () => {
  const shell = read('../src/randapp/Shell.jsx')
  const main = read('../src/main.jsx')
  assert.doesNotMatch(shell, /app-shell-foundation\.css/)
  assert.doesNotMatch(main, /app-shell-foundation\.css/)
  assert.equal(RANDUI_DESIGN_CONTRACT.layerOwners.responsiveGeometry, 'src/randapp/adaptive-layout.css')
  assert.equal(RANDUI_DESIGN_CONTRACT.layerOwners.finalFoundation, 'src/randapp/randui/foundation.css')
})
