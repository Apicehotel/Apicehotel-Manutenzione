import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HOTELS, ROLES } from '../src/config.js'
import { PERMISSION_ACTIONS, canRole } from '../src/permissions.js'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const adminModules = ['users', 'role_permissions', 'app_settings']
const operationalModules = ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians']

test('production hotel matrix is explicit, unique and stable', () => {
  assert.deepEqual(HOTELS.map((hotel) => hotel.id), ['hotelgio', 'chocohotel', 'brigantino'])
  assert.equal(new Set(HOTELS.map((hotel) => hotel.id)).size, HOTELS.length)
  for (const hotel of HOTELS) {
    assert.ok(hotel.name && hotel.short && hotel.card, `Hotel incompleto: ${hotel.id}`)
  }
})

test('all configured operational roles are unique and covered', () => {
  assert.equal(ROLES.length, 14)
  assert.equal(new Set(ROLES).size, ROLES.length)
  assert.ok(ROLES.includes('RandAI'))
  for (const role of ROLES) assert.equal(typeof role, 'string')
})

test('RandAI fallback keeps full control-center permissions when live matrix is unavailable', () => {
  for (const module of [...operationalModules, ...adminModules, 'sensors', 'usage', 'diagnostics']) {
    for (const action of PERMISSION_ACTIONS) assert.equal(canRole('RandAI', module, action), true, `${module}: ${action}`)
  }
})

test('Supremo remains view/create-only outside administration', () => {
  for (const module of operationalModules) {
    assert.equal(canRole('Supremo', module, 'view'), true, `${module}: view`)
    assert.equal(canRole('Supremo', module, 'create'), true, `${module}: create`)
    for (const action of PERMISSION_ACTIONS.filter((item) => !['view', 'create'].includes(item))) {
      assert.equal(canRole('Supremo', module, action), false, `${module}: ${action}`)
    }
  }
  for (const module of adminModules) {
    for (const action of PERMISSION_ACTIONS) assert.equal(canRole('Supremo', module, action), false, `${module}: ${action}`)
  }
})

test('housekeeping fallback matches production permissions during cold start/offline', () => {
  for (const role of ['Governante', 'Capo Governante', 'Reception']) {
    for (const action of ['view', 'edit', 'complete']) assert.equal(canRole(role, 'housekeeping', action), true, `${role}: housekeeping ${action}`)
    for (const action of ['create', 'assign', 'take_charge', 'delete', 'manage']) assert.equal(canRole(role, 'housekeeping', action), false, `${role}: housekeeping ${action}`)
  }
})

test('planning and reminder high-risk roles keep production contract', () => {
  for (const action of PERMISSION_ACTIONS) assert.equal(canRole('Direttore Centro Congressi', 'planning_sale', action), true, `DCC planning_sale ${action}`)
  for (const role of ['Direzione', 'Direttore Centro Congressi']) {
    for (const action of PERMISSION_ACTIONS) assert.equal(canRole(role, 'reminders', action), true, `${role} reminders ${action}`)
  }
  for (const action of ['view', 'take_charge', 'complete']) assert.equal(canRole('manutentore', 'planning_sale', action), true)
  for (const action of ['create', 'edit', 'assign', 'delete', 'manage']) assert.equal(canRole('manutentore', 'planning_sale', action), false)
  for (const role of ['Governante', 'Capo Governante']) {
    assert.equal(canRole(role, 'planning_work', 'view'), false)
    assert.equal(canRole(role, 'planning_sale', 'view'), false)
  }
})

test('department roles can report issues but cannot enter administration', () => {
  for (const role of ['Governante','Capo Governante','Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz']) {
    assert.equal(canRole(role, 'issues', 'view'), true, `${role}: issues view`)
    assert.equal(canRole(role, 'issues', 'create'), true, `${role}: issues create`)
    for (const module of adminModules) assert.equal(canRole(role, module, 'view'), false, `${role}: ${module}`)
  }
})

test('hotel switch preserves user identity and session requires both hotel and user', async () => {
  const [session, app] = await Promise.all([source('src/session.js'), source('src/randapp/App.jsx')])
  assert.match(session, /value\?\.hotelId && value\?\.userId/)
  assert.match(session, /localStorage\.setItem\(KEY, JSON\.stringify\(session\)\)/)
  assert.match(app, /saveSession\(\{ \.\.\.session, hotelId: id \}\)/)
  assert.match(app, /saveSession\(\{ hotelId, userId: pending\.userId/)
})

test('navigation remains double-gated by permissions and per-role placement', async () => {
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /VIEW_GUARDS\[targetView\]/)
  assert.match(shell, /placement\(key\) !== 'off'/)
  assert.match(shell, /canUser\(user, 'issues', 'create'\)/)
  assert.match(shell, /viewAllowed\('planning-sale'\)/)
})
