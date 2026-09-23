import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPrimaryBottomNav } from '../src/randapp/shell-navigation.js'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Governante and Capo Governante bottom nav is Segnalazioni Housekeeping Home Task Rifornimenti', () => {
  const placement = () => 'side'
  const allowed = new Set(['issues','housekeeping','supplies','home','my-work'])
  for (const role of ['Governante','Capo Governante']) {
    const nav = buildPrimaryBottomNav({
      placement,
      viewAllowed: (id) => allowed.has(id),
      user: { role },
    })
    assert.deepEqual(nav.map((item) => item.id), ['issues','housekeeping','home','my-work','supplies'])
    assert.deepEqual(nav.map((item) => item.slot), [1,2,3,4,5])
    assert.equal(nav.some((item) => item.id === 'chat'), false)
    assert.equal(nav.some((item) => item.id === 'randai'), false)
  }
})

test('Task view loads only alerts and reminders', async () => {
  const task = await read('src/randapp/operations/TaskView.jsx')
  assert.match(task, /fetchUrgents/)
  assert.match(task, /fetchReminders/)
  assert.doesNotMatch(task, /fetchIssues/)
  assert.doesNotMatch(task, /fetchPlanned/)
  assert.doesNotMatch(task, /fetchPlanned|planning-work|planning-sale/)
  assert.doesNotMatch(task, /Interventi|I miei lavori/)
})

test('housekeeping roles cannot enter Chat but keep RandAI and Segnalazioni', async () => {
  const nav = await read('src/randapp/nav.js')
  assert.match(nav, /chat: \(u\) => Boolean\(u\?\.chat_enabled\) && !\['Governante','Capo Governante'\]\.includes\(u\?\.role\)/)
  assert.match(nav, /randai: \(\) => true/)
  assert.match(nav, /id: 'issues'.*label: 'Segnalazioni'.*canUser\(user, 'issues', 'view'\)/s)
})

test('housekeeping Task permissions are read-only and do not grant interventions or planning', async () => {
  const sql = await read('supabase/migrations/20260923050000_housekeeping_task_permissions.sql')
  assert.match(sql, /cross join \(values \('urgent'\),\('reminders'\)\)/)
  assert.match(sql, /'view', true/)
  assert.match(sql, /\('interventions'\),\('planning_work'\),\('planning_sale'\)/)
  assert.match(sql, /'view', false/)
})


test('housekeeping sidebar keeps RandAI available while Chat stays hidden', async () => {
  const nav = await read('src/randapp/nav.js')
  assert.match(nav, /id: 'randai'.*label: 'RandAI'.*show: true/s)
  assert.match(nav, /id: 'chat'.*show: Boolean\(user\.chat_enabled\) && !\['Governante','Capo Governante'\]\.includes\(user\.role\)/s)
})


test('RandAI remains a sidebar placement item', async () => {
  const roleNav = await read('src/randapp/role-navigation.js')
  assert.match(roleNav, /\['randai', 'RandAI'\]/)
  assert.match(roleNav, /randai: 'side'/)
})


test('Task stays fixed even when live task permissions are temporarily stale', () => {
  const placement = () => 'side'
  for (const role of ['Governante','Capo Governante']) {
    const nav = buildPrimaryBottomNav({
      placement,
      viewAllowed: (id) => ['issues','housekeeping','home','supplies'].includes(id),
      user: { role },
    })
    assert.deepEqual(nav.map((item) => item.id), ['issues','housekeeping','home','my-work','supplies'])
  }
})
