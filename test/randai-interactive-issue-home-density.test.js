import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const assistant = read('../src/randai/RandAIAssistant.jsx')
const card = read('../src/randai/IssueChatCard.jsx')
const shell = read('../src/randapp/Shell.jsx')
const home = read('../src/randapp/Home.jsx')
const density = read('../src/randapp/home-density.css')
const hubs = read('../src/randapp/randui-hubs.css')
const operations = read('../src/randapp/operations/OperationsHub.jsx')
const planning = read('../src/randapp/PlanningHub.jsx')

test('RandAI uses existing chat and renders issue cards within assistant messages', () => {
  assert.match(assistant, /kind: 'issue-card'/)
  assert.match(assistant, /<IssueChatCard hotelId=\{session\.hotelId\}/)
  assert.match(shell, /<RandAIAssistant variant="page" user=\{user\}/)
  assert.match(card, /fetchIssues\(hotelId\)/)
  assert.match(card, /issue\.hotelId === hotelId/)
})

test('chat issue mutations require permission, confirmation and fresh verification', () => {
  assert.match(card, /canUser\(user, 'issues', 'view'\)/)
  assert.match(card, /canUser\(user, 'issues', 'edit'\)/)
  assert.match(card, /canUser\(user, 'issues', 'complete'\)/)
  assert.match(card, /window\.confirm\(/)
  assert.match(card, /updateIssueRow\(issue\.id/)
  assert.match(card, /await fetchIssues\(hotelId\)/)
  assert.match(card, /!navigator\.onLine/)
})

test('Home chart layout is selectable and remembers the choice', () => {
  assert.match(home, /randapp-home-chart-mode/)
  for (const value of ['full', 'compact', 'hidden']) assert.match(home, new RegExp(value))
  assert.match(home, /localStorage\.setItem/)
  assert.match(home, /chartMode!==['"]hidden['"]/)
  assert.match(density, /rnx-chartcard--compact/)
})

test('Operations and Planning retain their current navigation and denser layout', () => {
  assert.match(operations, /operations-top-preview/)
  assert.match(planning, /PlanningTodaySummary/)
  assert.match(hubs, /rv2-operations/)
  assert.match(hubs, /rv2-planning/)
  assert.match(hubs, /overflow-wrap:break-word/)
  assert.doesNotMatch(density, /\.rnx-(topbar|bottomnav)/)
})
