import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const visual = read('../src/randapp/randui/visual-language.css')
const hub = read('../src/randapp/PlanningHub.jsx')
const overview = read('../src/randapp/planning/PlanningOverview.jsx')
const planningCounts = read('../src/randapp/planning/PlanningCountCards.jsx')
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
  assert.match(visual, /@media \(max-width:\s*767px\)[\s\S]*\.rs-planning-counts__grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/)
  assert.match(visual, /@media \(max-width:\s*380px\)[\s\S]*\.rs-planning-counts__grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
})

test('Planning counts are shared with Operatività and Task', () => {
  assert.match(planningCounts, /PlanningChoice/)
  assert.match(planningCounts, /data-testid="planning-count-cards"/)
  assert.match(planningCounts, /fetchPlanningWork/)
  assert.match(planningCounts, /fetchBookings/)
  assert.match(operations, /PlanningCountCards/)
  assert.match(myWork, /PlanningCountCards/)
})

test('Operatività and Task put useful work before planning shortcuts', () => {
  const opsIssues = operations.indexOf("operations-open-issues")
  const opsCounts = operations.indexOf('<PlanningCountCards')
  assert.ok(opsIssues >= 0 && opsCounts >= 0)
  assert.ok(opsIssues < opsCounts)
  assert.match(operations, /rs-ops-surface/)
  assert.match(operations, /rs-planning-counts--compact/)
  assert.match(operations, /scorciatoie planning/i)

  const taskPending = myWork.indexOf('Da fare / in attesa')
  const taskDoneIssues = myWork.indexOf('Segnalazioni completate da me')
  const taskCounts = myWork.lastIndexOf('<PlanningCountCards')
  assert.ok(taskPending >= 0 && taskDoneIssues >= 0 && taskCounts >= 0)
  assert.ok(taskPending < taskCounts, 'planning shortcuts come after open work')
  assert.ok(taskDoneIssues < taskCounts, 'planning shortcuts come after completed personal work')
  assert.equal((myWork.match(/<PlanningCountCards/g) || []).length, 1, 'Task mounts planning shortcuts once')
  assert.match(myWork, /eyebrow="Task"/)
  assert.match(myWork, /rs-ops-toolbar/)
  assert.match(visual, /\.rs-ops-surface/)
  assert.match(visual, /\.rs-planning-counts--compact/)
})

test('Planning count cards stay visible while loading and use shortcut labeling', () => {
  assert.match(planningCounts, /Scorciatoie planning/)
  assert.match(planningCounts, /aria-busy=\{loading/)
  assert.doesNotMatch(planningCounts, /\|\|\s*loading\)\s*return null/)
  assert.match(planningCounts, /loading \? \{ today: 0, finish: 0, done: 0 \}/)
})

test('notification onboarding no longer traps iPhone users over page content', () => {
  assert.match(onboarding, /aria-label="Chiudi avviso notifiche"/)
  assert.match(onboarding, /sessionStorage\.setItem\(dismissalKey\(id\),'1'\)/)
  assert.match(onboarding, /dismissed\(hotelId\)/)
  assert.match(onboardingCss, /\.rs-notification-onboarding__close/)
  assert.match(onboardingCss, /var\(--rs-nav-h/)
})
