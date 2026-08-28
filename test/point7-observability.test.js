import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('point 7: diagnostics capture is bounded, deduplicated and resilient offline', async () => {
  const code = await source('src/diagnostics-client.js')
  assert.match(code, /MAX_QUEUE = 50/)
  assert.match(code, /DEDUPE_MS = 30000/)
  assert.match(code, /diagnostic_events/)
  assert.match(code, /window\.addEventListener\('online', flushDiagnosticEvents\)/)
  assert.match(code, /unhandledrejection/)
  assert.match(code, /window-error/)
})

test('point 7: diagnostics dashboard checks app services and exposes build identity', async () => {
  const [tab, vite] = await Promise.all([
    source('src/randapp/admin/DiagnosticsTab.jsx'),
    source('vite.config.js'),
  ])
  for (const label of ['Supabase API', 'Sessione', 'Realtime', 'Service Worker', 'Push', 'Coda offline', 'ntfy', 'Diagnostica locale']) {
    assert.match(tab, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(tab, /Copia report/)
  assert.match(vite, /__RANDAPP_BUILD__/)
  assert.match(vite, /VERCEL_GIT_COMMIT_SHA/)
})

test('point 7: settings keeps five bottom actions and diagnostics is an explicit admin tool', async () => {
  const settings = await source('src/randapp/Settings.jsx')
  assert.match(settings, /const TABS = \[/)
  assert.match(settings, /const DIAGNOSTICS/)
  assert.match(settings, /IconButton icon="wrench" label="Diagnostica"/)
  const navTabs = [...settings.matchAll(/\{ id:'(users|sensors|navigation|appearance)'/g)].map((match) => match[1])
  assert.deepEqual(navTabs, ['users', 'sensors', 'navigation', 'appearance'])
  assert.match(settings, /<small>RandApp<\/small>/)
})

test('point 7: render crashes are centrally reported without making diagnostics an initial static dependency', async () => {
  const [boundary, main] = await Promise.all([
    source('src/error-boundary.jsx'),
    source('src/main.jsx'),
  ])
  assert.match(boundary, /import\('\.\/diagnostics-client\.js'\)/)
  assert.match(boundary, /severity: 'fatal'/)
  assert.match(boundary, /kind: 'react-render'/)
  assert.match(main, /import\('\.\/diagnostics-client\.js'\)/)
  assert.doesNotMatch(main, /import \{[^}]*installDiagnosticsCapture[^}]*\} from '\.\/diagnostics-client\.js'/)
})

test('point 7: diagnostic events are protected by membership and admin RLS', async () => {
  const migration = await source('supabase/migrations/20260828065000_diagnostic_events_v1.sql')
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /auth_user_id = auth\.uid\(\)/)
  assert.match(migration, /is_hotel_member\(hotel_id\)/)
  assert.match(migration, /can_admin_hotel\(hotel_id\)/)
  assert.match(migration, /revoke all on public\.diagnostic_events from anon/i)
})
