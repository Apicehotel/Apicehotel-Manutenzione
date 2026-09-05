import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { auditRandUiComposition } from '../src/randapp/randui/guard.js'
import {
  RANDUI_MIGRATED_PAGE_IDS,
  RANDUI_PAGE_CATALOG,
  RANDUI_PAGE_MIGRATION_STAGE,
  listRandUiPages,
} from '../src/randapp/randui/page-catalog.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const REQUIRED_RUNTIME_PAGES = [
  'home','issues','chat','housekeeping','supplies','interventions','inventory','my-work',
  'planning-work','planning-sale','urgent','reminders','temperature','plants','technicians',
  'profile','pin','manual','feedback','feedback-received','desktop-download','settings','randai',
]

test('Block 3 catalog covers every current runtime destination, including secondary views', () => {
  assert.equal(RANDUI_PAGE_MIGRATION_STAGE, 'template-boundary-v1')
  assert.deepEqual([...RANDUI_MIGRATED_PAGE_IDS].sort(), [...REQUIRED_RUNTIME_PAGES].sort())
  assert.equal(listRandUiPages().length, REQUIRED_RUNTIME_PAGES.length)
  for (const id of REQUIRED_RUNTIME_PAGES) {
    const page = RANDUI_PAGE_CATALOG[id]
    assert.ok(page, `${id} missing from RandUI page catalog`)
    assert.equal(page.migration, RANDUI_PAGE_MIGRATION_STAGE)
    assert.equal(auditRandUiComposition(page, { components:['TemplateFrame'] }).length, 0, `${id} cannot enter its template boundary`)
  }
})

test('PageBoundary is fail-closed and stamps canonical migration metadata', () => {
  const boundary = read('../src/randapp/randui/PageBoundary.jsx')
  assert.match(boundary, /randUiPageFor\(pageId\)/)
  assert.match(boundary, /throw new Error\(`RandUI page is not catalogued:/)
  assert.match(boundary, /assertRandUiComposition\(page/)
  assert.match(boundary, /<TemplateFrame/)
  assert.match(boundary, /data-randui-page=\{page\.id\}/)
  assert.match(boundary, /data-randui-migration=\{page\.migration\}/)
})

test('Shell routes operational content through one RandUI boundary and legacy wrappers stay dead', () => {
  const shell = read('../src/randapp/Shell.jsx')
  assert.match(shell, /RandUiPageBoundary/)
  assert.match(shell, /<RandUiPageBoundary pageId=\{view\}>\{content\}<\/RandUiPageBoundary>/)
  assert.match(shell, /<Settings initialTab=\{settings\}[^\n]* embedded \/>/)
  assert.doesNotMatch(shell, /rs-legacy--temperature/)
  assert.doesNotMatch(shell, /rs-legacy--housekeeping/)
  for (const id of REQUIRED_RUNTIME_PAGES.filter((id) => !['settings','randai'].includes(id))) {
    assert.ok(RANDUI_PAGE_CATALOG[id], `${id} must be available to the Shell boundary`)
  }
})

test('Block 3 remains an adaptation layer rather than a second design system', () => {
  const boundary = read('../src/randapp/randui/PageBoundary.jsx')
  const pkg = JSON.parse(read('../package.json'))
  assert.doesNotMatch(boundary, /@mui|antd|chakra|bootstrap|semantic-ui|styled-components/)
  assert.match(pkg.scripts['test:randui'], /randui-block3-migration\.test\.js/)
  assert.equal(pkg.scripts['test:randui:migration'], 'node --test test/randui-block3-migration.test.js')
})
