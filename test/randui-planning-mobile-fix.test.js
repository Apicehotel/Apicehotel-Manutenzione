import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const visual = read('../src/randapp/randui/visual-language.css')
const hub = read('../src/randapp/PlanningHub.jsx')
const overview = read('../src/randapp/planning/PlanningOverview.jsx')
const operations = read('../src/randapp/operations/OperationsHub.jsx')
const myWork = read('../src/randapp/operations/MyWorkView.jsx')
const onboarding = read('../src/notification-onboarding.js')
const onboardingCss = read('../src/randapp/notification-onboarding.css')

test('RandUI Stack keeps rows content-sized instead of stretching into dead vertical space', () => {
  assert.match(visual, /\.rs-randui-stack\s*\{[^}]*align-content:\s*start;/s)
  assert.match(visual, /\.rs-randui-stack\s*\{[^}]*grid-auto-rows:\s*max-content;/s)
  assert.match(visual, /\.rs-randui-stack\s*>\s*\.rs-randui-local-header\s*\{\s*margin-bottom:\s*0;/)
})

test('Planning overview is compact and uses one today summary instead of duplicated surfaces', () => {
  assert.match(hub, /className="rs-planning-hub[^"]*"/)
  assert.match(hub, /<PlanningTodaySummary/)
  assert.doesNotMatch(hub, />Lavori oggi</)
  assert.doesNotMatch(hub, />Sale oggi</)
  assert.match(overview, /export function PlanningTodaySummary/)
  assert.match(overview, /data-testid="planning-today-summary"/)
  assert.match(visual, /\.rs-planning-choice-grid\s*\{\s*margin-bottom:\s*0;/)
  assert.match(visual, /\.rs-planning-today__items/)
})

test('Planning mobile keeps cards readable and removes the stretched header divider', () => {
  assert.match(visual, /\.rs-randui-page--planning\s+\.rs-randui-local-header\s*\{[^}]*border-bottom:\s*0;/s)
  assert.match(visual, /@media \(max-width:\s*380px\)[\s\S]*\.rs-planning-choice-grid\.rs-randui-grid--2\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
})

test('Operatività and Task do not embed Planning shortcuts', () => {
  assert.doesNotMatch(operations, /PlanningCountCards|Scorciatoie planning|Planning operativo|planning-work|planning-sale/)
  assert.doesNotMatch(myWork, /PlanningCountCards|Scorciatoie planning|Planning operativo|planning-work|planning-sale/)
  assert.equal(fs.existsSync(new URL('../src/randapp/planning/PlanningCountCards.jsx', import.meta.url)), false)
  assert.doesNotMatch(visual, /\.rs-planning-counts/)
  assert.match(operations, /rs-ops-surface/)
  assert.match(operations, /Segnalazioni e interventi adesso\./)
  assert.match(myWork, /eyebrow="Task"/)
  assert.match(myWork, /rs-ops-toolbar/)
  assert.match(visual, /\.rs-ops-surface/)
})

test('Operatività and Task flush title above content without stretched dead space', () => {
  assert.match(visual, /\.rs-ops-surface\s*\{[^}]*align-content:\s*start;/s)
  assert.match(visual, /\.rs-operations-hub\.rs-ops-surface[\s\S]*?grid-auto-rows:\s*max-content;/s)
  assert.match(visual, /\.rs-my-work\.rs-ops-surface[\s\S]*?align-content:\s*start;/s)
  assert.match(visual, /\.rs-ops-surface\s*>\s*\.rs-page-title[\s\S]*?margin:\s*0;/s)
})

test('notification onboarding no longer traps iPhone users over page content', () => {
  assert.match(onboarding, /aria-label="Chiudi avviso notifiche"/)
  assert.match(onboarding, /sessionStorage\.setItem\(dismissalKey\(id\),'1'\)/)
  assert.match(onboarding, /dismissed\(hotelId\)/)
  assert.match(onboardingCss, /\.rs-notification-onboarding__close/)
  assert.match(onboardingCss, /var\(--rs-nav-h/)
})
