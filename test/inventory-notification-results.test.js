import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import * as inventoryDomain from '../src/inventory-domain.js'
import * as validation from '../src/reliability/validation-engine.js'
import * as domainValidation from '../src/reliability/domain-validation.js'

// Run the production modules with deterministic I/O; never contact the live DB.
function load(path, dependencies, globals = {}, append = '') {
  const module = { exports: {} }
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { code } = transformSync(source + append, { loader: path.endsWith('jsx') ? 'jsx' : 'js', format: 'cjs', jsxFactory: 'h', jsxFragment: 'Fragment' })
  vm.runInNewContext(code, { module, exports: module.exports, Fragment: 'Fragment', require(name) { assert.ok(name in dependencies, name); return dependencies[name] }, ...globals })
  return module.exports
}
function component(path, dependencies, append = '') {
  const values = [], effects = []
  let cursor = 0
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next }] },
    useEffect: effect => effects.push(effect), useMemo: fn => fn(),
  }
  const h = (type, props, ...children) => ({ type, props: { ...props, children } })
  const ui = Object.fromEntries(['Badge','Button','Card','EmptyState','Field','Icon','Sheet','Spinner','TextInput'].map(name => [name, name]))
  const exports = load(path, { react, ...dependencies, './ui.jsx': ui, '../ui.jsx': ui }, { h, console: { warn() {} }, Date, Intl }, append)
  return { values, effects, render(name, props) { cursor = 0; effects.length = 0; return exports[name](props) } }
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
const button = (tree, label) => nodes(tree).find(node => node.type === 'Button' && node.props.children.includes(label))
const tick = () => new Promise(resolve => setImmediate(resolve))
const fail = async () => { throw new Error('Network unavailable') }
const item = { id: 'item', name: 'Lampada', quantity: 10, unit: 'pz' }
const viewProps = { hotel: { id: 'hotelgio', name: 'Hotel Giò' }, user: { id: 'operator' } }
function inventory(data = {}) {
  return component('src/randapp/InventoryView.jsx', {
    '../inventory-data.js': { fetchInventoryItems: async () => [], fetchInventoryCategories: async () => [], fetchInventoryLocations: async () => [], subscribeInventory: () => () => {}, ...data },
    '../async-timeout.js': { withTimeout: promise => promise }, '../inventory-domain.js': inventoryDomain,
    '../permissions.js': { canUser: () => true }, './randui/visual-primitives.jsx': { PageTitle: 'PageTitle' },
    './InventoryBlock2Panel.jsx': { default: 'InventoryBlock2Panel' }, './inventory.css': {},
  }, '\nexport { StockSheet }')
}
test('failed initial inventory load shows an error and retry, not an empty warehouse', async () => {
  let failed = true
  const view = inventory({ fetchInventoryItems: async () => { if (failed) return fail(); return [item] } })
  view.render('default', viewProps); view.effects[0](); await tick()
  let tree = view.render('default', viewProps)
  assert.ok(nodes(tree).some(node => node.props.role === 'alert'))
  assert.equal(nodes(tree).some(node => node.type === 'EmptyState' && node.props.title === 'Magazzino vuoto'), false)
  failed = false
  await button(tree, 'Riprova caricamento').props.onClick()
  tree = view.render('default', viewProps)
  assert.equal(nodes(tree).some(node => node.props.role === 'alert'), false)
  assert.equal(view.values[0][0].id, item.id)
})
test('a failed refresh preserves the previously loaded inventory', async () => {
  const view = inventory({ fetchInventoryItems: fail })
  view.render('default', viewProps); view.values[0] = [item]
  view.effects[0](); await tick()
  const tree = view.render('default', viewProps)
  assert.equal(view.values[0][0].id, item.id)
  assert.ok(nodes(tree).some(node => node.props.role === 'alert'))
})
test('successful stock write followed by failed history cannot be resubmitted as a retry', async () => {
  let writes = 0
  const view = inventory({ fetchInventoryMovements: fail })
  const props = { item, open: true, onClose() {}, onAdjusted: async () => { writes++ } }
  let tree = view.render('StockSheet', props)
  await button(tree, 'Registra prelievo').props.onClick()
  tree = view.render('StockSheet', props)
  assert.equal(writes, 1)
  assert.equal(button(tree, 'Registra prelievo').props.disabled, true)
  assert.ok(nodes(tree).some(node => node.props.role === 'status'))
  assert.match(view.values[6], /già registrato/)
  assert.equal(view.values[4], '')
  await button(tree, 'Registra prelievo').props.onClick()
  assert.equal(writes, 1)
})
test('a rejected stock write retains the draft and reports the write failure', async () => {
  let historyReads = 0
  const view = inventory({ fetchInventoryMovements: async () => { historyReads++; return [] } })
  const props = { item, open: true, onClose() {}, onAdjusted: fail }
  let tree = view.render('StockSheet', props)
  await button(tree, 'Registra prelievo').props.onClick()
  tree = view.render('StockSheet', props)
  assert.equal(button(tree, 'Registra prelievo').props.disabled, false)
  assert.match(view.values[4], /Network unavailable/)
  assert.equal(view.values[1], '1')
  assert.equal(historyReads, 0)
})
function createFixture({ rollback = 'success', adjustmentFails = true } = {}) {
  let deletions = 0
  const originalError = new Error('Adjustment failed')
  const supabase = {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: item.id, hotel_id: 'hotelgio', name: item.name } }) }) }),
      delete: () => { deletions++; const query = { eq: () => query, select: async () => { if (rollback === 'network') throw new Error('Delete failed'); return rollback === 'denied' ? { error: new Error('Denied') } : { data: rollback === 'zero' ? [] : [{ id: item.id }] } } }; return query },
    }),
    rpc: async () => adjustmentFails ? { error: originalError } : { data: { id: item.id, quantity: 5, name: item.name } },
  }
  const api = load('src/inventory-data.js', { './supabase.js': { supabase }, './reliability/validation-engine.js': validation, './reliability/domain-validation.js': domainValidation })
  return { api, deletions: () => deletions, originalError }
}
test('failed initial stock adjustment is awaited and compensated before rejection', async () => {
  const fixture = createFixture()
  await assert.rejects(() => fixture.api.createInventoryItem('hotelgio', { name: item.name, quantity: 5 }), error => error === fixture.originalError)
  assert.equal(fixture.deletions(), 1)
})
for (const rollback of ['denied', 'zero', 'network']) {
  test(`unconfirmed rollback (${rollback}) reports the retained item instead of offering silent retry`, async () => {
    const fixture = createFixture({ rollback })
    await assert.rejects(() => fixture.api.createInventoryItem('hotelgio', { name: item.name, quantity: 5 }), error => error.createdItemId === item.id && error.cause === fixture.originalError && /Non ricrearlo/.test(error.message))
    assert.equal(fixture.deletions(), 1)
  })
}
test('successful initial quantity returns the saved item without compensation', async () => {
  const fixture = createFixture({ adjustmentFails: false })
  assert.equal((await fixture.api.createInventoryItem('hotelgio', { name: item.name, quantity: 5 })).quantity, 5)
  assert.equal(fixture.deletions(), 0)
})
test('retained article closes the create flow and remains accompanied by its warning', async () => {
  const error = Object.assign(new Error('Non ricrearlo: verifica giacenza'), { createdItemId: item.id })
  const view = inventory({ createInventoryItem: async () => { throw error }, fetchInventoryItems: async () => [item] })
  let tree = view.render('default', viewProps)
  const form = nodes(tree).find(node => node.type?.name === 'NewItemSheet')
  await form.props.onSave({ name: item.name }) // Resolved: NewItemSheet can close.
  tree = view.render('default', viewProps)
  assert.equal(view.values[0][0].id, item.id)
  assert.ok(nodes(tree).some(node => node.props.role === 'alert' && node.props.children.includes(error.message)))
})
function inbox(persist) {
  let badge = -1
  const view = component('src/randapp/notifications/NotificationInbox.jsx', { '../../reliability/jwt-errors.js': { humanizeJwtClockError: () => null }, './notification-data.js': { markNotificationRead: persist, markAllNotificationsRead: persist }, './notification-inbox.css': {} })
  view.values.push([{ key: 'urgent:1', sourceId: '1', type: 'urgent', read: false, title: 'Avviso' }], false, 'all', '')
  const props = { hotel: { id: 'hotelgio' }, user: { role: 'admin' }, onUnreadChange: count => { badge = count } }
  const render = () => { const tree = view.render('default', props); view.effects.at(-1)(); return tree }
  return { view, render, badge: () => badge }
}
for (const action of ['single', 'all']) {
  for (const succeeds of [false, true]) {
    test(`${action} notification read ${succeeds ? 'updates after confirmation' : 'preserves unread state on failure'}`, async () => {
      const fixture = inbox(succeeds ? async () => {} : fail)
      let tree = fixture.render()
      if (action === 'all') await button(tree, 'Segna lette').props.onClick()
      else await nodes(tree).find(node => node.type === 'article').props.onClick()
      tree = fixture.render()
      assert.equal(fixture.view.values[0][0].read, succeeds)
      assert.equal(fixture.badge(), succeeds ? 0 : 1)
      assert.equal(nodes(tree).some(node => node.props.role === 'alert'), !succeeds)
    })
  }
}
test('a bulk read does not acknowledge a notification arriving during persistence', async () => {
  let finish
  const fixture = inbox(() => new Promise(resolve => { finish = resolve }))
  const reading = button(fixture.render(), 'Segna lette').props.onClick()
  fixture.view.values[0] = [...fixture.view.values[0], { key: 'urgent:2', type: 'urgent', read: false }]
  finish(); await reading; fixture.render()
  assert.equal(fixture.view.values[0][1].read, false)
  assert.equal(fixture.badge(), 1)
})
for (const method of ['markNotificationRead', 'markAllNotificationsRead']) {
  for (const state of ['auth-error', 'missing-user']) {
    test(`${method} rejects ${state} instead of silently reporting persistence`, async () => {
      let writes = 0
      const authError = new Error('Auth offline')
      const api = load('src/randapp/notifications/notification-data.js', { '../../supabase.js': { supabase: { auth: { getUser: async () => state === 'auth-error' ? { error: authError } : { data: {} } }, from: () => { writes++; throw new Error('Unexpected write') } } } })
      const notification = { sourceId: '1', type: 'urgent' }
      await assert.rejects(() => api[method]('hotelgio', method === 'markNotificationRead' ? notification : [notification]), /Auth offline|Sessione non valida/)
      assert.equal(writes, 0)
    })
  }
}
