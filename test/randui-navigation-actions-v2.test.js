import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const shell = read('../src/randapp/Shell.jsx')
const navigation = read('../src/randapp/shell-navigation.js')
const nav = read('../src/randapp/nav.js')
const roleNavigation = read('../src/randapp/role-navigation.js')
const contextualAdd = read('../src/randapp/contextual-add.js')
const planningHub = read('../src/randapp/PlanningHub.jsx')

test('bottom navigation keeps Task in slot four as reminders and alerts hub', () => {
  assert.match(navigation, /id:\s*'task'.*label:\s*'Task'.*slot:\s*TELEGRAM_PRIMARY_SLOTS\.contextual/s)
  assert.match(navigation, /viewAllowed\('task'\)/)
  assert.match(nav, /task:\s*canSeeTask/)
  assert.match(nav, /canUser\(user, 'reminders', 'view'\).*canUser\(user, 'urgent', 'view'\)/)
  assert.match(navigation, /view === 'task'/)
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

test('Planning legacy intervention bridge is gone and Task owns reminders plus alerts', () => {
  assert.doesNotMatch(planningHub, /randapp\.insert-source/)
  assert.doesNotMatch(planningHub, /PlannedCreateSheet/)
  assert.match(shell, /item\.id === 'task'[\s\S]*\['task', 'urgent', 'reminders'\]\.includes\(view\)/)
  assert.match(shell, /view === 'task'[\s\S]*<TaskHub/)
})
