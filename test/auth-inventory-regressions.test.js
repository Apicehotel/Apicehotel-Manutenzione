import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { AuthApiError, AuthRetryableFetchError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { isFutureJwtError } from '../src/reliability/jwt-errors.js'
import { isOfflineSessionFresh, MAX_OFFLINE_SESSION_MS } from '../src/session-policy.js'

// Execute the shipped modules with isolated I/O. No live credentials or writes.
function loadModule(path, dependencies, globals = {}, append = '') {
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { code } = transformSync(source + append, { loader: path.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs', jsxFactory: 'h', jsxFragment: 'Fragment' })
  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports, URLSearchParams, Fragment: 'Fragment', require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, ...globals })
  vm.runInContext(code, context)
  return module.exports
}
const session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'operator' } }
function validator(auth) {
  return loadModule('src/auth-data.js', {
    './supabase.js': { supabase: { auth: { getSession: async () => ({ data: { session } }), ...auth } } },
    './session-policy.js': {},
    './reliability/jwt-errors.js': { isFutureJwtError },
    '@supabase/supabase-js': { isAuthRetryableFetchError },
  }, { navigator: { onLine: true } }).validateSupabaseSession
}
for (const stage of ['session', 'user', 'refresh', 'revalidation']) {
  test(`temporary Auth failure at ${stage} defers validation instead of revoking session`, async () => {
    const temporary = new AuthRetryableFetchError('Service Unavailable', 503)
    const expired = new AuthApiError('JWT expired', 401, 'jwt_expired')
    let reads = 0
    const validate = validator({
      getSession: async () => ({ data: { session }, error: stage === 'session' ? temporary : null }),
      getUser: async () => ({ data: { user: null }, error: stage === 'user' || ++reads > 1 ? temporary : expired }),
      refreshSession: async () => ({ data: { session }, error: stage === 'refresh' ? temporary : null }),
    })
    await assert.rejects(validate, (error) => error === temporary)
    const now = Date.now()
    assert.equal(isOfflineSessionFresh({ lastValidatedAt: now - 1000 }, now), true)
    assert.equal(isOfflineSessionFresh({ lastValidatedAt: now - MAX_OFFLINE_SESSION_MS - 1 }, now), false)
  })
}
test('revoked credentials still invalidate the session', async () => {
  const validate = validator({ getUser: async () => ({ data: { user: null }, error: new AuthApiError('User not found', 401, 'user_not_found') }) })
  assert.equal((await validate()).valid, false)
})
test('a rejected refresh still fails closed; a successful refresh is verified', async () => {
  const expired = new AuthApiError('JWT expired', 401, 'jwt_expired')
  const validate = validator({ getUser: async () => ({ data: { user: null }, error: expired }), refreshSession: async () => ({ error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') }) })
  assert.equal((await validate()).valid, false)
  let reads = 0
  const recover = validator({ getUser: async () => ++reads === 1 ? { error: expired } : { data: { user: session.user } }, refreshSession: async () => ({ data: { session } }) })
  assert.equal((await recover()).refreshed, true)
  assert.equal(reads, 2)
})

// Hook state is isolated per component; handlers are taken from its rendered JSX.
function componentHarness(data = {}, globals = {}) {
  const values = []
  const effects = []
  let cursor = 0
  const h = (type, props, ...children) => ({ type, props: { ...props, children } })
  const ui = Object.fromEntries(['Badge', 'Button', 'Card', 'Field', 'Icon', 'Sheet', 'TextInput'].map(name => [name, name]))
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next }] },
    useRef(initial) { const [ref] = hooks.useState(() => ({ current: initial })); return ref },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: fn => effects.push(fn),
  }
  const exports = loadModule('src/randapp/InventoryBlock2Panel.jsx', {
    react: hooks, '../inventory-block2-data.js': data, '../permissions.js': {}, './ui.jsx': ui,
  }, { h, window: { location: { search: '' } }, ...globals }, '\nexport { StocktakeSheet, ScannerSheet }')
  return { values, effects, render(name, props) { cursor = 0; effects.length = 0; return exports[name](props) } }
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'Button' && n.props.children.includes(label))
const stockProps = { open: true, hotel: { id: 'hotelgio' }, items: [], locations: [], onClose() {}, onReload() {} }
function stocktake(drafts, lines = [{ id: 'A', itemId: 'item-A', countedQuantity: null }, { id: 'B', itemId: 'item-B', countedQuantity: null }]) {
  const writes = []
  const harness = componentHarness({ countStocktakeLine: async (id, quantity) => { writes.push({ id, quantity }); return { ...lines.find(l => l.id === id), countedQuantity: quantity } } })
  harness.values.push({ id: 'take' }, lines, '', drafts, false, '')
  return { harness, writes, tree: harness.render('StocktakeSheet', stockProps) }
}
for (const raw of ['', ' ', '-1', 'not-a-number']) {
  test(`stocktake rejects invalid count ${JSON.stringify(raw)} without writing`, async () => {
    const { tree, writes, harness } = stocktake({ A: raw, B: '7' })
    await button(tree, 'Salva').props.onClick()
    assert.equal(writes.length, 0)
    assert.match(harness.values[5], /conteggio valido/)
  })
}
test('explicit zero is saved while the other unsaved row is preserved', async () => {
  const { tree, writes, harness } = stocktake({ A: '0', B: '7' })
  await button(tree, 'Salva').props.onClick()
  assert.deepEqual(writes, [{ id: 'A', quantity: 0 }])
  assert.equal(harness.values[3].B, '7')
  assert.equal(harness.values[1][0].countedQuantity, 0)
})
test('saving a row preserves edits made to other rows during the request', async () => {
  const { tree, harness } = stocktake({ A: '3', B: '7' })
  const saving = button(tree, 'Salva').props.onClick()
  harness.values[3] = { A: '3', B: '12' }
  await saving
  assert.equal(harness.values[3].B, '12')
})
test('reconciliation requires all displayed drafts to have been saved', () => {
  const lines = [{ id: 'A', itemId: 'a', countedQuantity: 1 }, { id: 'B', itemId: 'b', countedQuantity: 2 }]
  assert.equal(button(stocktake({ A: '1', B: '9' }, lines).tree, 'Chiudi e riconcilia').props.disabled, true)
  assert.equal(button(stocktake({ A: '1', B: '' }, lines).tree, 'Chiudi e riconcilia').props.disabled, true)
  assert.equal(button(stocktake({ A: '1', B: '2' }, lines).tree, 'Chiudi e riconcilia').props.disabled, false)
})
function scanner() {
  const pending = []
  let stops = 0
  const harness = componentHarness({}, {
    window: { location: { search: '' }, BarcodeDetector: class { detect() { return [] } } },
    navigator: { mediaDevices: { getUserMedia: () => new Promise(resolve => pending.push(resolve)) } },
    setTimeout: fn => fn(), requestAnimationFrame() {},
  })
  const tree = harness.render('ScannerSheet', { open: true, hotel: { id: 'hotelgio' }, onClose() {}, onFound() {} })
  const cleanups = harness.effects.map(fn => fn()).filter(fn => typeof fn === 'function')
  const stream = () => ({ getTracks: () => [{ stop: () => { stops++ } }] })
  return { harness, tree, pending, stream, cleanups, stops: () => stops }
}
for (const cleanup of ['close', 'unmount']) {
  test(`camera permission resolving after ${cleanup} releases the late stream`, async () => {
    const s = scanner()
    const opening = button(s.tree, 'Apri scanner').props.onClick()
    if (cleanup === 'close') s.tree.props.onClose()
    else s.cleanups.forEach(fn => fn())
    s.pending[0](s.stream())
    await opening
    assert.equal(s.stops(), 1)
    assert.equal(s.harness.values[2], false)
  })
}
test('overlapping camera starts discard the older stream', async () => {
  const s = scanner()
  const first = button(s.tree, 'Apri scanner').props.onClick()
  const second = button(s.tree, 'Apri scanner').props.onClick()
  s.pending[0](s.stream())
  await first
  assert.equal(s.stops(), 1)
  s.pending[1](s.stream())
  await second // No mounted video: the new stream is also released.
  assert.equal(s.stops(), 2)
})
test('video playback failure releases the active stream', async () => {
  const s = scanner()
  s.harness.values[3].current = { play: async () => { throw new Error('Playback failed') } }
  const opening = button(s.tree, 'Apri scanner').props.onClick()
  s.pending[0](s.stream())
  await opening
  assert.equal(s.stops() > 0, true)
  assert.equal(s.harness.values[2], false)
  assert.equal(s.harness.values[1], 'Playback failed')
})
