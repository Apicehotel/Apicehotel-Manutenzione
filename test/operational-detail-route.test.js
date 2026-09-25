import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const shell = read('src/randapp/Shell.jsx')
const issues = read('src/randapp/Issues.jsx')
const interventions = read('src/randapp/operations/InterventionsView.jsx')
const detail = read('src/randapp/OperationalDetailPage.jsx')
const css = read('src/randapp/operational-detail.css')
const adaptive = read('src/randapp/adaptive-layout.css')

test('operational detail has one canonical surface for all operational domains', () => {
  assert.match(detail, /OPERATIONAL_DETAIL_KINDS = Object\.freeze\(\['issue', 'intervention', 'task', 'supply'\]\)/)
  assert.match(detail, /data-testid="operational-detail"/)
  assert.match(detail, /data-testid="operational-detail-back">Indietro<\/Button>/)
})

test('Shell owns focus mode and removes competing application chrome', () => {
  assert.match(shell, /const \[operationalDetail, setOperationalDetail\] = useState\(null\)/)
  assert.match(shell, /operationalDetailOpen \? 'rs-app--operational-detail'/)
  assert.match(shell, /!operationalDetailOpen && <aside className="rs-sidebar"/)
  assert.match(shell, /!operationalDetailOpen && <header className="rs-header/)
  assert.match(shell, /!operationalDetailOpen && <nav className="rs-bottomnav/)
  assert.match(shell, /!operationalDetailOpen && contextualActionIds\.length > 0/)
  assert.equal((shell.match(/onDetailChange=\{handleOperationalDetailChange\}/g) || []).length, 5)
})

test('all resource details replace their lists instead of stacking over them', () => {
  assert.match(issues, /if \(activeIssue\) return <IssueDetail/)
  assert.match(issues, /<OperationalDetailPage kind="issue"/)
  assert.doesNotMatch(issues.slice(issues.indexOf('function IssueDetail'), issues.indexOf('export default function Issues')), /<Sheet open onClose=\{onClose\}/)
  assert.match(interventions, /if \(selected\) return <PlannedDetail/)
  assert.match(interventions, /<OperationalDetailPage kind="intervention"/)
  assert.doesNotMatch(interventions.slice(interventions.indexOf('function PlannedDetail')), /<Sheet open onClose=\{onClose\}/)
  assert.match(shell, /<UrgentView[^>]*onDetailChange=\{handleOperationalDetailChange\}/)
  assert.match(shell, /<RemindersView[^>]*onDetailChange=\{handleOperationalDetailChange\}/)
  assert.match(shell, /<SupplyRequestsPortal[^>]*onDetailChange=\{handleOperationalDetailChange\}/)
})

test('focus mode owns safe areas, keyboard viewport, landscape and desktop', () => {
  assert.match(css, /min-height:\s*var\(--rs-app-viewport-min-height\)/)
  assert.match(css, /var\(--rs-adaptive-safe-top, 0px\)/)
  assert.match(css, /var\(--rs-adaptive-safe-bottom, 0px\)/)
  assert.match(adaptive, /data-keyboard-open='true'/)
  assert.match(adaptive, /--rs-app-viewport-min-height:\s*var\(--rs-visual-viewport-height/)
  assert.match(css, /orientation:\s*landscape/)
  assert.match(css, /min-width:\s*900px/)
  assert.match(css, /overflow-y:\s*auto/)
})


test('Focus Mode keeps the canonical drawer reachable through a compact menu trigger', () => {
  const shell = read('src/randapp/Shell.jsx')
  const css = read('src/randapp/operational-detail.css')
  assert.match(shell, /operationalDetailOpen && !drawer/)
  assert.match(shell, /data-testid="operational-menu-trigger"/)
  assert.match(shell, /icon="menu"/)
  assert.match(shell, /onClick=\{\(\) => setDrawer\(true\)\}/)
  assert.match(css, /\.rs-operational-menu-trigger\s*\{/)
  assert.match(css, /z-index:\s*88/)
})

test('Focus Mode propagates viewport height through RandUI wrappers so the Dock stays visible', () => {
  const css = read('src/randapp/operational-detail.css')
  assert.match(css, /\.rs-app--operational-detail \.rs-randui-page,[\s\S]*\.rs-randui-page__content[\s\S]*height:\s*100%/)
  assert.match(css, /\.rs-app--operational-detail \.rs-randui-page__body[\s\S]*overflow:\s*hidden/)
  assert.match(css, /\.rs-app--operational-detail \.rs-randui-page__content > \.rs-operational-detail[\s\S]*min-height:\s*0/)
  assert.match(css, /\.rs-app--operational-detail \.rs-operational-detail__head[\s\S]*padding-right:/)
})
