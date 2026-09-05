import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { RANDUI_COMPONENT_REGISTRY } from '../src/randapp/randui/component-registry.js'
import { listRandUiTemplates } from '../src/randapp/randui/template-registry.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const VISUAL_COMPONENTS = ['PageTitle', 'Surface', 'Stack', 'Grid', 'Metric']
const WIDTHS = new Set(['wide', 'reading', 'center'])
const RHYTHMS = new Set(['compact', 'normal', 'comfortable'])

const PLANNING_TOP_LEVEL = [
  '../src/randapp/PlanningHub.jsx',
  '../src/randapp/PlanningWorkSimple.jsx',
  '../src/randapp/PlanningSaleSimple.jsx',
  '../src/randapp/planning/PlanningOverview.jsx',
]

test('every RandUI template owns an explicit visual policy and shared visual primitives', () => {
  const templates = listRandUiTemplates()
  assert.equal(templates.length, 14)
  for (const template of templates) {
    assert.ok(WIDTHS.has(template.visual?.width), `${template.id} has invalid visual width`)
    assert.ok(RHYTHMS.has(template.visual?.rhythm), `${template.id} has invalid visual rhythm`)
    for (const component of VISUAL_COMPONENTS) {
      assert.ok(template.allowedComponents.includes(component), `${template.id} does not allow ${component}`)
    }
  }
})

test('visual primitives are first-class RandUI registry components', () => {
  for (const component of VISUAL_COMPONENTS) {
    const entry = RANDUI_COMPONENT_REGISTRY[component]
    assert.ok(entry, `${component} missing from component registry`)
    assert.equal(entry.source, './visual-primitives.jsx')
  }
})

test('TemplateFrame stamps width and rhythm policy into the rendered boundary', () => {
  const templates = read('../src/randapp/randui/templates.jsx')
  assert.match(templates, /data-randui-width=\{template\.visual\.width\}/)
  assert.match(templates, /data-randui-rhythm=\{template\.visual\.rhythm\}/)
})

test('visual language is owned by the final RandUI foundation', () => {
  const foundation = read('../src/randapp/randui/foundation.css')
  const visual = read('../src/randapp/randui/visual-language.css')
  assert.match(foundation, /@import '\.\/visual-language\.css';/)
  assert.ok(foundation.indexOf("@import './visual-language.css';") > foundation.indexOf("@import '../ui-coherence.css';"))
  for (const selector of ['.rs-randui-surface', '.rs-randui-stack', '.rs-randui-grid', '.rs-randui-metric', '.rs-randui-local-header']) {
    assert.ok(visual.includes(selector), `${selector} missing from visual language`)
  }
})

test('planning top-level family no longer owns arbitrary inline geometry', () => {
  for (const path of PLANNING_TOP_LEVEL) {
    const source = read(path)
    assert.doesNotMatch(source, /style=\{\{/i, `${path} contains page geometry inline`)
  }
})

test('shared operational PageTitle resolves to the canonical RandUI primitive', () => {
  const source = read('../src/randapp/operations/view-primitives.jsx')
  assert.match(source, /export \{ PageTitle \} from '\.\.\/randui\/visual-primitives\.jsx'/)
  assert.doesNotMatch(source, /function PageTitle/)
})

test('obsolete migrated CSS bridge cannot return', () => {
  const legacy = new URL('../src/randapp/migrated.css', import.meta.url)
  const main = read('../src/main.jsx')
  assert.equal(fs.existsSync(legacy), false)
  assert.doesNotMatch(main, /migrated\.css/)
  assert.match(main, /randui\/foundation\.css/)
})
