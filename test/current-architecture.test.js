import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('runtime uses the modular RandApp entry, not the legacy root App', async () => {
  const main = await source('src/main.jsx')
  const app = await source('src/App.jsx')
  assert.match(main, /lazy\(\(\) => import\('\.\/randapp\/App\.jsx'\)\)/)
  assert.doesNotMatch(main, /import App from '\.\/App\.jsx'/)
  assert.match(app, /export \{ default \} from '\.\/randapp\/App\.jsx'/)
  assert.ok(app.length < 500, 'root App must remain a thin compatibility entry')
})

test('Shell imports operational views directly from focused modules', async () => {
  const [shell, shellNavigation] = await Promise.all([
    source('src/randapp/Shell.jsx'),
    source('src/randapp/shell-navigation.js'),
  ])
  assert.match(shell, /operations\/InterventionsView\.jsx/)
  assert.match(shell, /operations\/UrgentView\.jsx/)
  assert.match(shell, /operations\/MyWorkView\.jsx/)
  assert.match(shell, /operations\/UtilityLightViews\.jsx/)
  assert.doesNotMatch(shell, /operations\/UtilityViews\.jsx/)
  assert.doesNotMatch(shell, /MigratedViews/)
  assert.match(shell, /buildPrimaryBottomNav/)
  assert.match(shell, /data-count="5"/)
  assert.match(shellNavigation, /home:\s*3/)
  assert.match(shellNavigation, /randai:\s*5/)
  assert.match(shellNavigation, /id:\s*'randai'.*key:\s*'randai'/s)
  assert.doesNotMatch(shellNavigation, /id:\s*'randai'.*action:\s*'randai'/s)
  assert.match(shell, /view === 'randai'.*<RandAIAssistantPage mode="page"/s)
  assert.match(shell, /data-testid="header-randai"/)
  assert.match(shell, /header__randai[\s\S]*randai-toggle/)
  assert.doesNotMatch(shell, /handleBottom[\s\S]{0,400}randai-toggle/)
  assert.doesNotMatch(shellNavigation, /label:\s*'Altro'/)
  assert.doesNotMatch(shellNavigation, /allowed\.length <= 5/)
})

test('admin is split into focused tabs and Settings only orchestrates them', async () => {
  const settings = await source('src/randapp/Settings.jsx')
  for (const tab of ['UsersTab','SensorsTab','RolesTab','UsageTab']) assert.match(settings, new RegExp(`admin/${tab}\\.jsx`))
  assert.doesNotMatch(settings, /AppearanceTab|label:'Aspetto'/)
  assert.match(settings, /label:'Consumi'/)
  assert.ok(settings.length < 5000, 'Settings must remain an orchestration shell')
  const usage = await source('src/randapp/admin/UsageTab.jsx')
  assert.match(usage, /get_usage_stats/)
  assert.match(usage, /Per struttura/)
  const users = await source('src/randapp/admin/UsersTab.jsx')
  assert.match(users, /Housekeeping · \$\{h\.short\}/)
  assert.match(users, /setUserActive/)
  assert.match(users, /Disattivato/)
})

test('permissions are module/action based and central', async () => {
  const [permissions, nav, helpers, shell, home, issues] = await Promise.all([
    source('src/permissions.js'), source('src/randapp/nav.js'), source('src/randapp/helpers.js'), source('src/randapp/Shell.jsx'), source('src/randapp/Home.jsx'), source('src/randapp/Issues.jsx'),
  ])
  assert.match(permissions, /PERMISSION_ACTIONS/); assert.match(permissions, /PERMISSION_MODULES/); assert.match(permissions, /canUser/); assert.match(nav, /canUser/)
  assert.match(shell, /canUser\(user, 'issues', 'create'\)/); assert.match(home, /canUser\(user, 'issues', 'create'\)/)
  assert.match(issues, /canUser\(user, 'issues', 'create'\)/); assert.match(issues, /canUser\(user, 'issues', 'complete'\)/); assert.match(issues, /canUser\(user, 'issues', 'delete'\)/)
  assert.doesNotMatch(nav, /ROLE_PERMISSIONS/); assert.doesNotMatch(helpers, /ROLE_PERMISSIONS|permsFor|export const can =/); assert.doesNotMatch(home, /\bcan\(user,/); assert.doesNotMatch(issues, /\bcan\(user,/)
})
