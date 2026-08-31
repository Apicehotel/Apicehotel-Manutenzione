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
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /operations\/InterventionsView\.jsx/)
  assert.match(shell, /operations\/UrgentView\.jsx/)
  assert.match(shell, /operations\/MyWorkView\.jsx/)
  assert.match(shell, /operations\/UtilityLightViews\.jsx/)
  assert.doesNotMatch(shell, /operations\/UtilityViews\.jsx/)
  assert.doesNotMatch(shell, /MigratedViews/)
  assert.match(shell, /if \(allowed\.length <= 5\) return allowed/)
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

test('Planning Sale is decomposed into focused components', async () => {
  const planning = await source('src/randapp/PlanningSaleSimple.jsx')
  for (const component of ['SaleBookingForm','SaleBookingCard','SaleRoomConfigSheet']) assert.match(planning, new RegExp(component))
  assert.ok(planning.length < 15000, 'PlanningSaleSimple must stay an orchestrator rather than a monolith')
  const bookingForm = await source('src/randapp/planning/SaleBookingForm.jsx'); assert.match(bookingForm, /SaleRoomPicker/)
  await Promise.all([source('src/randapp/planning/SaleBookingCard.jsx'),source('src/randapp/planning/SaleRoomPicker.jsx'),source('src/randapp/planning/SaleRoomConfigSheet.jsx'),source('src/randapp/planning/sale-utils.js')])
})

test('reminders notifications and ntfy are independent modules', async () => {
  const [shell, profile, reminders, reminderData, inbox, notificationData, ntfySetup, ntfyClient] = await Promise.all([source('src/randapp/Shell.jsx'),source('src/randapp/Profile.jsx'),source('src/randapp/reminders/RemindersView.jsx'),source('src/randapp/reminders/reminder-data.js'),source('src/randapp/notifications/NotificationInbox.jsx'),source('src/randapp/notifications/notification-data.js'),source('src/randapp/ntfy/NtfySetup.jsx'),source('src/randapp/ntfy/ntfy-client.js')])
  assert.match(shell, /reminders\/RemindersView\.jsx/); assert.match(shell, /notifications\/NotificationInbox\.jsx/); assert.match(profile, /ntfy\/NtfySetup\.jsx/); assert.match(reminders, /\.\/reminder-data\.js/); assert.match(inbox, /\.\/notification-data\.js/); assert.match(ntfySetup, /\.\/ntfy-client\.js/); assert.match(reminderData, /canUser\(user, 'reminders'/); assert.match(notificationData, /notification_reads/); assert.match(ntfyClient, /functions\/v1/); assert.doesNotMatch(reminders, /notification_reads|ntfy-config|ntfy-alert/); assert.doesNotMatch(inbox, /createReminder|updateReminder|deleteReminder/); assert.doesNotMatch(ntfyClient, /promemoria|richieste_urgenti|notification_reads/)
})

test('active CSS is explicit at the runtime entry and legacy global stacks are gone', async () => {
  const main = await source('src/main.jsx'); assert.match(main, /randapp\/shell\.css/); assert.match(main, /randapp\/adaptive-layout\.css/)
  for (const legacy of ['clean-ui.css','approved-dark-shell.css','unified-ui-v1.css','randapp-layout-overhaul.css','admin-mobile-v2.css']) assert.doesNotMatch(main, new RegExp(legacy.replace('.', '\\.')))
  assert.match(main, /import\('\.\/styles\.css'\)/)
})

test('Housekeeping, issues and profile remain independent domain modules', async () => {
  const [housekeeping, issues, profile] = await Promise.all([source('src/housekeeping-v2.jsx'),source('src/randapp/Issues.jsx'),source('src/randapp/Profile.jsx')])
  assert.match(housekeeping, /export/); assert.match(issues, /export default/); assert.match(profile, /export default/)
})
