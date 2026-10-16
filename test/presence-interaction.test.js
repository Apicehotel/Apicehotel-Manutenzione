import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

function harness({ read, write = async () => ({ in_struttura: true, in_struttura_hotel_id: 'hotelgio' }), online = true } = {}) {
  const state = [], effects = [], listeners = new Map(), timers = new Map()
  let cursor = 0
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value }] },
    useRef(initial) { const i = cursor++; return state[i] ||= { current: initial } },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const module = { exports: {} }
  const h = (type, props, ...children) => ({ type, props, children })
  const source = fs.readFileSync(new URL('../src/randapp/PresenceChip.jsx', import.meta.url), 'utf8')
  const { code } = transformSync(source, { loader: 'jsx', format: 'cjs', jsxFactory: 'h' })
  const dependencies = { react: hooks, '../auth-data.js': { setOwnPresence: write }, '../session.js': { loadSession: () => ({ hotelId: 'hotelgio' }) }, '../supabase.js': { supabase: { functions: { invoke: read } } }, './helpers.js': { hotelById: id => ({ id, name: id }) } }
  vm.runInNewContext(code, { module, exports: module.exports, require: key => { assert.ok(key in dependencies); return dependencies[key] }, h, navigator: { onLine: online }, window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key), dispatchEvent: event => listeners.get(event.type)?.() }, CustomEvent: class { constructor(type) { this.type = type } }, setTimeout: (fn, ms) => { timers.set(ms, fn); return ms }, clearTimeout: ms => timers.delete(ms) })
  return {
    render(role = 'admin', hotelId = 'hotelgio') { cursor = 0; effects.length = 0; return module.exports.default({ user: { id: 'operator', role }, hotel: { id: hotelId, name: hotelId } }) },
    installExpiry() { return effects[1]() },
    mount() { const cleanup = effects[0](); return cleanup }, listeners, timers,
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
const status = (extra = {}) => ({ data: { ok: true, eligible: true, role: 'admin', present: false, hotel_id: null, ...extra } })

test('initial presence read failure leaves the explicit action available with unknown state', async () => {
  const app = harness({ read: async () => ({ error: new Error('Rete assente') }) })
  app.render(); app.mount(); await settle()
  const button = app.render()
  assert.equal(button.props['data-presence'], 'unknown')
  assert.match(button.props['aria-label'], /Sono in struttura/)
  assert.match(button.props.title, /Rete assente/)
  await button.props.onClick()
  assert.equal(app.render().props['data-here'], 'true')
})

test('failed presence write preserves confirmed state and its error survives refresh events during write', async () => {
  let rejectWrite
  const app = harness({ read: async () => status(), write: () => new Promise((_resolve, reject) => { rejectWrite = reject }) })
  app.render(); app.mount(); await settle()
  const pending = app.render().props.onClick()
  app.listeners.get('focus')()
  rejectWrite(new Error('Scrittura rifiutata'))
  await pending
  const button = app.render()
  assert.equal(button.props['data-presence'], 'out')
  assert.equal(button.props.title, 'Scrittura rifiutata')
  assert.equal(button.props.disabled, false)
})

test('late initial read cannot overwrite successful presence write', async () => {
  let finishRead
  const app = harness({ read: () => new Promise(resolve => { finishRead = resolve }) })
  app.render(); app.mount()
  await app.render().props.onClick()
  finishRead(status())
  await settle()
  assert.equal(app.render().props['data-here'], 'true')
})

test('presence in another hotel moves to selected hotel and repeated taps write once', async () => {
  const writes = []
  let finishWrite
  const app = harness({ read: async () => status({ present: true, hotel_id: 'hotelgio' }), write: (...args) => { writes.push(args); return new Promise(resolve => { finishWrite = resolve }) } })
  app.render(); app.mount(); await settle()
  const button = app.render('admin', 'chocohotel')
  assert.equal(button.props['data-here'], 'false')
  const pending = button.props.onClick()
  await button.props.onClick()
  assert.deepEqual(writes, [[true, 'chocohotel']])
  finishWrite({ in_struttura: true, in_struttura_hotel_id: 'chocohotel' })
  await pending
  assert.equal(app.render('admin', 'chocohotel').props['data-here'], 'true')
})

test('offline presence is unknown and ineligible server response hides the action', async () => {
  const offline = harness({ online: false, read: () => { throw new Error('must not fetch') } })
  offline.render(); offline.mount()
  assert.match(offline.render().props.title, /offline/)
  const denied = harness({ read: async () => status({ eligible: false }) })
  denied.render(); denied.mount(); await settle()
  assert.equal(denied.render(), null)
  assert.equal(harness().render('reception'), null)
})

test('server expiry invalidates the displayed state and rereads presence', async () => {
  let reads = 0
  const app = harness({ read: async () => ++reads === 1 ? status({ present: true, hotel_id: 'hotelgio', expires_at: new Date(Date.now() + 1000).toISOString() }) : status() })
  app.render(); app.mount(); await settle()
  app.render()
  assert.equal(app.render().props['data-here'], 'true')
  app.installExpiry()
  assert.equal(app.timers.size, 1)
  const expire = [...app.timers.values()][0]
  expire()
  assert.equal(app.render().props['data-presence'], 'unknown')
  await settle()
  assert.equal(app.render().props['data-presence'], 'out')
  assert.equal(reads, 2)
})
