import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const home = fs.readFileSync(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8')

test('point 13 home ranks actionable work instead of freeform widgets', () => {
  assert.match(home, /buildPriorityItems/)
  assert.match(home, /score:\s*100/)
  assert.match(home, /weather\.level === 'danger' \? 96 : 82/)
  assert.match(home, /item\.urgency === 'alta' \? 92/)
  assert.match(home, /sort\(\(a, b\) => b\.score - a\.score/)
  assert.doesNotMatch(home, /ReactGridLayout/)
  assert.doesNotMatch(home, /useWidgetStore/)
})

test('point 13 home uses hotel-scoped operational sources', () => {
  for (const call of ['fetchIssues(hotel.id)', 'fetchUrgents(hotel.id)', 'fetchPlanned(hotel.id)', 'fetchReminders(hotel.id)', 'fetchOperationalWeather(hotel.id']) {
    assert.ok(home.includes(call), `${call} must remain hotel scoped`)
  }
})

test('point 13 home is role and permission aware', () => {
  for (const moduleName of ['issues', 'urgent', 'interventions', 'reminders', 'housekeeping']) {
    assert.match(home, new RegExp(`canUser\\(user, '${moduleName}'`))
  }
  assert.match(home, /target_roles/)
  assert.match(home, /includes\(user\?\.role\)/)
})

test('point 13 home includes today reminders, weather and interventions', () => {
  assert.match(home, /reminderDueToday/)
  assert.match(home, /repeat_kind === 'daily'/)
  assert.match(home, /repeat_kind === 'weekly'/)
  assert.match(home, /repeat_kind === 'monthly'/)
  assert.match(home, /weather\?\.level === 'danger'/)
  assert.match(home, /todayInterventions/)
})

test('point 13 keeps useful personalization as focus versus complete view', () => {
  assert.match(home, /randapp\.home\.focus\.v1/)
  assert.match(home, />Focus</)
  assert.match(home, />Completa</)
  assert.match(home, /personalizeSignal/)
  assert.match(home, /setPreferencesOpen\(true\)/)
})
