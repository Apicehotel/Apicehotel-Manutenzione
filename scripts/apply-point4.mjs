import { readFile, writeFile, mkdir } from 'node:fs/promises'

const shellPath = 'src/randapp/Shell.jsx'
let s = await readFile(shellPath, 'utf8')
s = s.replace("import { useCallback, useEffect, useMemo, useState } from 'react'", "import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'")
s = s.replace("import { Icon, IconButton, Sheet, EmptyState, UiSizeControl, ThemeControl } from './ui.jsx'", "import { Icon, IconButton, Sheet, EmptyState, Spinner, UiSizeControl, ThemeControl } from './ui.jsx'")
for (const imp of [
  "import Issues from './Issues.jsx'\n", "import Settings from './Settings.jsx'\n", "import Profile from './Profile.jsx'\n",
  "import PlanningHub from './PlanningHub.jsx'\n", "import RemindersView from './reminders/RemindersView.jsx'\n",
  "import NotificationInbox from './notifications/NotificationInbox.jsx'\n", "import InsertLauncher from './InsertLauncher.jsx'\n",
  "import UrgentCreateSheet from './UrgentCreateSheet.jsx'\n", "import InterventionsView from './operations/InterventionsView.jsx'\n",
  "import UrgentView from './operations/UrgentView.jsx'\n", "import MyWorkView from './operations/MyWorkView.jsx'\n",
]) s = s.replace(imp, '')
s = s.replace("import {\n  TemperatureView, HousekeepingView, TechnicianDirectoryView,\n  FeedbackView, PinView, ManualView,\n} from './operations/UtilityViews.jsx'\n", '')
const marker = "import './header-mobile.css'\n"
const defs = `

const Settings = lazy(() => import('./Settings.jsx'))
const Issues = lazy(() => import('./Issues.jsx'))
const Profile = lazy(() => import('./Profile.jsx'))
const PlanningHub = lazy(() => import('./PlanningHub.jsx'))
const RemindersView = lazy(() => import('./reminders/RemindersView.jsx'))
const NotificationInbox = lazy(() => import('./notifications/NotificationInbox.jsx'))
const InsertLauncher = lazy(() => import('./InsertLauncher.jsx'))
const UrgentCreateSheet = lazy(() => import('./UrgentCreateSheet.jsx'))
const InterventionsView = lazy(() => import('./operations/InterventionsView.jsx'))
const UrgentView = lazy(() => import('./operations/UrgentView.jsx'))
const MyWorkView = lazy(() => import('./operations/MyWorkView.jsx'))
const TemperatureView = lazy(() => import('../temperature.jsx').then(({ TemperatureSensors }) => ({
  default: ({ hotel }) => <div className="rs-legacy rs-legacy--temperature" data-testid="temperature-view"><TemperatureSensors hotel={hotel} /></div>,
})))
const HousekeepingView = lazy(() => import('../housekeeping.jsx').then(({ Housekeeping }) => ({
  default: ({ hotel, user }) => <div className="rs-legacy rs-legacy--housekeeping" data-testid="housekeeping-view"><Housekeeping hotel={hotel} user={user} /></div>,
})))
const TechnicianDirectoryView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.TechnicianDirectoryView })))
const FeedbackView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.FeedbackView })))
const PinView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.PinView })))
const ManualView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.ManualView })))

const ViewFallback = () => <Spinner label="Carico sezione…" />
`
if (!s.includes("const Settings = lazy(")) s = s.replace(marker, marker + defs)
s = s.replace("if (settings !== null) return <Settings initialTab={settings} onExit={() => setSettings(null)} />", "if (settings !== null) return <Suspense fallback={<ViewFallback />}><Settings initialTab={settings} onExit={() => setSettings(null)} /></Suspense>")
s = s.replace('<main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts />{renderView()}</main>', '<main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts /><Suspense fallback={<ViewFallback />}>{renderView()}</Suspense></main>')
s = s.replace('<InsertLauncher open={insertOpen} onClose={() => setInsertOpen(false)} hotel={hotel} user={user} onPick={pickInsert} allowedActions={insertAllowed} />', '{insertOpen && <Suspense fallback={null}><InsertLauncher open={insertOpen} onClose={() => setInsertOpen(false)} hotel={hotel} user={user} onPick={pickInsert} allowedActions={insertAllowed} /></Suspense>}')
s = s.replace("<UrgentCreateSheet open={urgentCreateOpen} onClose={() => setUrgentCreateOpen(false)} hotel={hotel} user={user} onSaved={() => { if (viewAllowed('urgent')) setView('urgent') }} />", "{urgentCreateOpen && <Suspense fallback={null}><UrgentCreateSheet open={urgentCreateOpen} onClose={() => setUrgentCreateOpen(false)} hotel={hotel} user={user} onSaved={() => { if (viewAllowed('urgent')) setView('urgent') }} /></Suspense>}")
s = s.replace("<NotificationInbox hotel={hotel} user={user} onUnreadChange={setNotificationUnread} canOpenUrgent={viewAllowed('urgent')} canManageReminders={viewAllowed('reminders')} onOpenUrgent={() => { setNotificationsOpen(false); setView('urgent') }} onOpenReminders={() => { setNotificationsOpen(false); setView('reminders') }} />", "<Suspense fallback={<ViewFallback />}><NotificationInbox hotel={hotel} user={user} onUnreadChange={setNotificationUnread} canOpenUrgent={viewAllowed('urgent')} canManageReminders={viewAllowed('reminders')} onOpenUrgent={() => { setNotificationsOpen(false); setView('urgent') }} onOpenReminders={() => { setNotificationsOpen(false); setView('reminders') }} /></Suspense>")
await writeFile(shellPath, s)

let light = await readFile('src/randapp/operations/UtilityViews.jsx', 'utf8')
light = light.replace("import { TemperatureSensors } from '../../temperature.jsx'\n", '').replace("import { Housekeeping } from '../../housekeeping.jsx'\n", '')
light = light.replace(/^export function TemperatureView.*\n/m, '').replace(/^export function HousekeepingView.*\n/m, '')
await writeFile('src/randapp/operations/UtilityLightViews.jsx', light)

let vite = await readFile('vite.config.js', 'utf8')
if (!vite.includes('manifest: true')) vite = vite.replace("  plugins: [react()],\n", "  plugins: [react()],\n  build: { manifest: true },\n")
await writeFile('vite.config.js', vite)

await mkdir('scripts', { recursive: true })
await writeFile('scripts/check-bundle.mjs', `import { readFile, stat } from 'node:fs/promises'\nimport path from 'node:path'\nconst manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))\nconst entry = Object.values(manifest).find((item) => item.isEntry)\nif (!entry) throw new Error('Vite manifest: entry chunk non trovato')\nconst visited = new Set()\nlet total = 0\nasync function visit(key) {\n  const item = manifest[key]\n  if (!item?.file || visited.has(item.file)) return\n  visited.add(item.file)\n  total += (await stat(path.join('dist', item.file))).size\n  for (const dep of item.imports || []) await visit(dep)\n}\nconst entryKey = Object.entries(manifest).find(([, item]) => item.isEntry)?.[0]\nawait visit(entryKey)\nconst limit = 700 * 1024\nconsole.log(\`Initial JS: \${(total/1024).toFixed(1)} KiB across \${visited.size} static chunk(s); budget \${limit/1024} KiB\`)\nif (total > limit) throw new Error(\`Initial JS bundle oltre budget: \${total} > \${limit}\`)\nconst xlsxKeys = Object.entries(manifest).filter(([key,item]) => key.includes('xlsx') || String(item.src||'').includes('xlsx') || String(item.file||'').includes('xlsx'))\nfor (const [,item] of xlsxKeys) if (visited.has(item.file)) throw new Error('xlsx è finito nel percorso JS iniziale')\n`)

let ci = await readFile('.github/workflows/ci.yml', 'utf8')
if (!ci.includes('Bundle budget')) ci = ci.replace("      - name: Unit tests\n", "      - name: Bundle budget\n        run: node scripts/check-bundle.mjs\n\n      - name: Unit tests\n")
await writeFile('.github/workflows/ci.yml', ci)

await writeFile('test/performance-architecture.test.js', `import assert from 'node:assert/strict'\nimport { readFile } from 'node:fs/promises'\nimport test from 'node:test'\nconst source = (path) => readFile(new URL(\`../\${path}\`, import.meta.url), 'utf8')\ntest('heavy RandApp views are route-lazy while Home stays immediate', async () => {\n  const shell = await source('src/randapp/Shell.jsx')\n  assert.match(shell, /import \\{ lazy, Suspense,/)\n  assert.match(shell, /import Home from '\\.\\/Home\\.jsx'/)\n  for (const p of ['./Issues.jsx','./Settings.jsx','./Profile.jsx','./PlanningHub.jsx','./reminders/RemindersView.jsx','./notifications/NotificationInbox.jsx','./operations/InterventionsView.jsx','./operations/UrgentView.jsx','./operations/MyWorkView.jsx']) assert.ok(shell.includes(\`lazy(() => import('\${p}')\`), p)\n  assert.doesNotMatch(shell, /import Issues from/)\n  assert.match(shell, /<Suspense fallback=\\{<ViewFallback \\/>\\}>\\{renderView\\(\\)\\}<\\/Suspense>/)\n})\ntest('Housekeeping and spreadsheet code stay outside initial route graph', async () => {\n  const [shell, report, vite] = await Promise.all([source('src/randapp/Shell.jsx'), source('src/housekeeping-report.js'), source('vite.config.js')])\n  assert.match(shell, /lazy\\(\\(\\) => import\\('\.\.\\/housekeeping\\.jsx'\\)/)\n  assert.match(report, /await import\\('xlsx'\\)/)\n  assert.doesNotMatch(report, /^import .* from 'xlsx'/m)\n  assert.match(vite, /manifest: true/)\n})\ntest('utility routes no longer pull Housekeeping and Temperature together', async () => {\n  const light = await source('src/randapp/operations/UtilityLightViews.jsx')\n  assert.doesNotMatch(light, /housekeeping\\.jsx|temperature\\.jsx|HousekeepingView|TemperatureView/)\n  for (const name of ['TechnicianDirectoryView','FeedbackView','PinView','ManualView']) assert.match(light, new RegExp(name))\n})\n`)
