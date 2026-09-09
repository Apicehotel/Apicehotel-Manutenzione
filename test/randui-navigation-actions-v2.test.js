import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildPrimaryBottomNav } from '../src/randapp/shell-navigation.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const shell = read('../src/randapp/Shell.jsx')
const navigation = read('../src/randapp/shell-navigation.js')
const nav = read('../src/randapp/nav.js')
const roleNavigation = read('../src/randapp/role-navigation.js')
const contextualAdd = read('../src/randapp/contextual-add.js')
const planningHub = read('../src/randapp/PlanningHub.jsx')

test('bottom navigation prefers Task in slot four and protects it like interventions', () => {
  const config = { interventions: 'bottom', chat: 'bottom' }
  const build = denied => buildPrimaryBottomNav({ placement: key => config[key] || 'side', viewAllowed: id => id !== denied })
  assert.equal(build().find(item => item.slot === 4)?.id, 'my-work')
  assert.equal(build('my-work').find(item => item.slot === 4)?.id, 'chat')
  assert.match(nav, /'my-work':\s*view\('interventions'\)/)
  assert.match(roleNavigation, /'my-work':\s*'interventions'/)
  assert.match(navigation, /view === 'my-work'/)
})

test('contextual plus creates only the object owned by the active page', () => {
  assert.match(contextualAdd, /intervention:\s*\{[^}]*title:\s*'Nuovo intervento'/s)
  assert.match(contextualAdd, /case 'interventions':[\s\S]*?return clean\(\['intervention'\]/)
  assert.match(contextualAdd, /case 'planning-work':[\s\S]*?return clean\(\['planning-work'\]/)
  assert.match(contextualAdd, /case 'planning-sale':[\s\S]*?return clean\(\['planning-sale'\]/)
  assert.doesNotMatch(contextualAdd, /case 'planning-work':\s*\n\s*case 'planning-sale':/)
})

test('Interventi plus opens the canonical intervention sheet without detouring through Planning', () => {
  assert.match(shell, /id === 'intervention'.*viewAllowed\('interventions'\)/s)
  assert.match(shell, /setView\('interventions'\)[\s\S]*setInterventionCreateOpen\(true\)/)
  assert.match(shell, /<PlannedCreateSheet open=\{interventionCreateOpen\}/)
  assert.match(shell, /canUser\(user, 'interventions', 'create'\)/)
})

test('Planning navigation is navigation-only and stale create requests are cleared', () => {
  assert.match(shell, /const handleBottom = \(item\) =>[\s\S]*setPlanningCreateRequest\(null\)[\s\S]*setView\(item\.id\)/)
  assert.match(shell, /setView\(kind === 'sale' \? 'planning-sale' : 'planning-work'\)/)
  assert.match(planningHub, /onSectionChange\?\.\('work'\)/)
  assert.match(planningHub, /onSectionChange\?\.\('sale'\)/)
  assert.match(planningHub, /onCreateRequestConsumed\?\.\(createRequest\.kind\)/)
})

test('Planning legacy intervention bridge is gone and Task has an independent active state', () => {
  assert.doesNotMatch(planningHub, /randapp\.insert-source/)
  assert.doesNotMatch(planningHub, /PlannedCreateSheet/)
  assert.doesNotMatch(shell, /\['operations', 'issues', 'interventions', 'my-work'\]/)
  assert.match(shell, /\['operations', 'issues', 'interventions'\]\.includes\(view\)/)
})
