import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('runtime uses the modular RandApp entry, not the legacy root App', async () => {
  const main = await source('src/main.jsx')
  const app = await source('src/App.jsx')
  assert.match(main, /import App from '\.\/randapp\/App\.jsx'/)
  assert.match(app, /export \{ default \} from '\.\/randapp\/App\.jsx'/)
  assert.ok(app.length < 500, 'root App must remain a thin compatibility entry')
})

test('Shell imports operational views directly from focused modules', async () => {
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /operations\/InterventionsView\.jsx/)
  assert.match(shell, /operations\/UrgentView\.jsx/)
  assert.match(shell, /operations\/MyWorkView\.jsx/)
  assert.match(shell, /operations\/UtilityViews\.jsx/)
  assert.doesNotMatch(shell, /MigratedViews/)
  assert.match(shell, /if \(allowed\.length <= 5\) return allowed/)
})

test('admin is split into focused tabs and Settings only orchestrates them', async () => {
  const settings = await source('src/randapp/Settings.jsx')
  for (const tab of ['UsersTab','SensorsTab','RolesTab','AppearanceTab']) assert.match(settings, new RegExp(`admin/${tab}\\.jsx`))
  assert.ok(settings.length < 5000, 'Settings must remain an orchestration shell')
  const users = await source('src/randapp/admin/UsersTab.jsx')
  assert.match(users, /Housekeeping · \$\{h\.short\}/)
  assert.match(users, /setUserActive/)
  assert.match(users, /Disattivato/)
})

test('permissions are module/action based and central', async () => {
  const permissions = await source('src/permissions.js')
  const nav = await source('src/randapp/nav.js')
  assert.match(permissions, /PERMISSION_ACTIONS/)
  assert.match(permissions, /PERMISSION_MODULES/)
  assert.match(permissions, /canUser/)
  assert.match(nav, /canUser/)
  assert.doesNotMatch(nav, /ROLE_PERMISSIONS/)
})

test('Planning Sale is decomposed into focused components', async () => {
  const planning = await source('src/randapp/PlanningSaleSimple.jsx')
  for (const component of ['SaleBookingForm','SaleBookingCard','SaleRoomConfigSheet']) assert.match(planning, new RegExp(component))
  assert.ok(planning.length < 15000, 'PlanningSaleSimple must stay an orchestrator rather than a monolith')
  const bookingForm = await source('src/randapp/planning/SaleBookingForm.jsx')
  assert.match(bookingForm, /SaleRoomPicker/)
  await Promise.all([
    source('src/randapp/planning/SaleBookingCard.jsx'),
    source('src/randapp/planning/SaleRoomPicker.jsx'),
    source('src/randapp/planning/SaleRoomConfigSheet.jsx'),
    source('src/randapp/planning/sale-utils.js'),
  ])
})

test('active CSS is explicit at the runtime entry and legacy global stacks are gone', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /randapp\/shell\.css/)
  assert.match(main, /randapp\/adaptive-layout\.css/)
  for (const legacy of ['clean-ui.css','approved-dark-shell.css','unified-ui-v1.css','randapp-layout-overhaul.css','admin-mobile-v2.css']) {
    assert.doesNotMatch(main, new RegExp(legacy.replace('.', '\\.')))
  }
  assert.match(main, /import\('\.\/styles\.css'\)/)
})

test('Housekeeping, issues and profile remain independent domain modules', async () => {
  const [housekeeping, issues, profile] = await Promise.all([
    source('src/housekeeping-v2.jsx'),
    source('src/randapp/Issues.jsx'),
    source('src/randapp/Profile.jsx'),
  ])
  assert.match(housekeeping, /export/)
  assert.match(issues, /export default/)
  assert.match(profile, /export default/)
})
