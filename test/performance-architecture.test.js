import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
test('login and authenticated RandApp are separate lazy boundaries', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /const Shell = lazy\(\(\) => import\('.\/Shell\.jsx'\)\)/)
  assert.match(app, /const Settings = lazy\(\(\) => import\('.\/Settings\.jsx'\)\)/)
  assert.doesNotMatch(app, /import Shell from|import Settings from/)
  assert.match(app, /<Suspense fallback=\{<Spinner label="Avvio RandApp…" \/>\}>/)
})
test('heavy RandApp views are route-lazy while Home stays immediate after auth', async () => {
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /import \{ lazy, Suspense,/)
  assert.match(shell, /import Home from '\.\/Home\.jsx'/)
  for (const p of ['./Issues.jsx','./Settings.jsx','./Profile.jsx','./PlanningHub.jsx','./reminders/RemindersView.jsx','./notifications/NotificationInbox.jsx','./operations/InterventionsView.jsx','./operations/UrgentView.jsx','./operations/MyWorkView.jsx']) assert.ok(shell.includes(`lazy(() => import('${p}')`), p)
  assert.doesNotMatch(shell, /import Issues from/)
  assert.match(shell, /<Suspense fallback=\{<ViewFallback \/>\}>\{renderView\(\)\}<\/Suspense>/)
})
test('Housekeeping and spreadsheet code stay outside initial route graph', async () => {
  const [shell, report, vite] = await Promise.all([source('src/randapp/Shell.jsx'), source('src/housekeeping-report.js'), source('vite.config.js')])
  assert.match(shell, /lazy\(\(\) => import\('..\/housekeeping\.jsx'\)/)
  assert.match(report, /await import\('xlsx'\)/)
  assert.doesNotMatch(report, /^import .* from 'xlsx'/m)
  assert.match(vite, /manifest: true/)
})
test('utility routes no longer pull Housekeeping and Temperature together', async () => {
  const light = await source('src/randapp/operations/UtilityLightViews.jsx')
  assert.doesNotMatch(light, /housekeeping\.jsx|temperature\.jsx|HousekeepingView|TemperatureView/)
  for (const name of ['TechnicianDirectoryView','FeedbackView','PinView','ManualView']) assert.match(light, new RegExp(name))
})

test('Supabase-backed auth and directory are deferred from the entry module', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.doesNotMatch(app, /^import .*users-data\.js/m)
  assert.doesNotMatch(app, /^import .*auth-data\.js/m)
  assert.match(app, /await import\('..\/users-data\.js'\)/)
  assert.match(app, /await import\('..\/auth-data\.js'\)/)
})

test('vendor chunking is explicit without hiding the total bundle budget', async () => {
  const [vite, budget] = await Promise.all([source('vite.config.js'), source('scripts/check-bundle.mjs')])
  assert.match(vite, /supabase-vendor/)
  assert.match(vite, /react-vendor/)
  assert.match(budget, /600 \* 1024/)
  assert.match(budget, /500 \* 1024/)
})
