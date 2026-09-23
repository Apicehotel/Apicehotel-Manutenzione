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
const operationsHub = read('../src/randapp/operations/OperationsHub.jsx')

test('bottom navigation treats Task as alerts and reminders, not interventions', () => {
  assert.match(navigation, /id:\s*'my-work'.*label:\s*'Task'.*slot:\s*TELEGRAM_PRIMARY_SLOTS\.contextual/s)
  assert.match(navigation, /placement\('task'\).*viewAllowed\('my-work'\)/s)
  assert.match(nav, /'my-work':\s*\(u\) => \['Governante','Capo Governante'\]\.includes\(u\?\.role\) \|\| canUser\(u, 'urgent', 'view'\) \|\| canUser\(u, 'reminders', 'view'\)/)
  assert.match(roleNavigation, /'my-work':\s*'task'/)
  assert.doesNotMatch(navigation, /placement\('interventions'\).*label:\s*'Task'/s)
  assert.match(navigation, /view === 'my-work'/)
})

test('contextual plus keeps Task on Avvisi and Planning offers work or sale', () => {
  assert.ok(contextualAdd.includes("case 'interventions':\n      return clean(['intervention'], capabilities)"))
  assert.ok(contextualAdd.includes("case 'my-work':\n      return clean(['urgent'], capabilities)"))
  assert.ok(!contextualAdd.includes("case 'my-work':\n      return clean(['intervention'], capabilities)"))
  assert.ok(contextualAdd.includes("case 'planning-work':\n      return clean(['planning-work', 'planning-sale'], capabilities)"))
  assert.ok(contextualAdd.includes("case 'planning-sale':\n      return clean(['planning-sale'], capabilities)"))
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


test('Operatività renders both top-3 previews', () => {
  assert.ok(operationsHub.includes('operations-top-issues'))
  assert.ok(operationsHub.includes('Top 3 Segnalazioni'))
  assert.ok(operationsHub.includes('operations-top-interventions'))
  assert.ok(operationsHub.includes('Top 3 Interventi'))
  assert.ok(operationsHub.includes('issueTopPreview(issues)'))
  assert.ok(operationsHub.includes('interventionTopPreview(planned)'))
})
