import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('nav prefetch warms primary bottom destinations and related hubs', async () => {
  const prefetch = await source('src/randapp/nav-prefetch.js')
  assert.match(prefetch, /relatedPrefetchIds/)
  assert.match(prefetch, /scheduleNavPrefetch/)
  assert.match(prefetch, /operations.*issues.*interventions/s)
  assert.match(prefetch, /my-work.*urgent.*reminders/s)
  assert.match(prefetch, /import\('\.\/Issues\.jsx'\)/)
  assert.match(prefetch, /import\('\.\/PlanningHub\.jsx'\)/)
  assert.match(prefetch, /import\('\.\/operations\/TaskView\.jsx'\)/)
})

test('Shell schedules idle prefetch and warms on pointerdown/focus', async () => {
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /scheduleNavPrefetch/)
  assert.match(shell, /prefetchViews/)
  assert.match(shell, /onPointerDown=\{\(\) => warmNavDestination\(item\.id\)\}/)
  assert.match(shell, /onFocus=\{\(\) => warmNavDestination\(item\.id\)\}/)
  assert.match(shell, /lazyWithRetry\(\(\) => import\('\.\/Issues\.jsx'\)\)/)
})

test('operational lists paint from session/IndexedDB cache before network', async () => {
  const [issues, interventions, urgent, task, planning, cache] = await Promise.all([
    source('src/randapp/Issues.jsx'),
    source('src/randapp/operations/InterventionsView.jsx'),
    source('src/randapp/operations/UrgentView.jsx'),
    source('src/randapp/operations/TaskView.jsx'),
    source('src/randapp/PlanningHub.jsx'),
    source('src/randapp/view-session-cache.js'),
  ])
  assert.match(cache, /takeViewCache/)
  assert.match(cache, /putViewCache/)
  assert.match(issues, /peekCachedIssues/)
  assert.match(issues, /reload\(\{ soft: true \}\)/)
  assert.match(interventions, /peekCachedPlanned/)
  assert.match(interventions, /load\(\{ soft: true \}\)/)
  assert.match(urgent, /peekCachedUrgents/)
  assert.match(urgent, /load\(\{ soft: true \}\)/)
  assert.match(task, /peekCachedUrgents/)
  assert.match(task, /load\(\{ soft: true \}\)/)
  assert.match(planning, /takeViewCache/)
  assert.match(planning, /load\(\{soft:true\}\)/)
})
