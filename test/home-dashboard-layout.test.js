import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME_DASHBOARD_CARDS, resolveHomeDashboardLayout } from '../src/randapp/home-dashboard-layout.js'

test('Home dashboard keeps only permission-visible cards and never leaves invalid spans', () => {
  const layout = resolveHomeDashboardLayout(['status', 'planning', 'randai'], 'normal')
  assert.deepEqual(layout.map((item) => item.id), ['status', 'planning', 'randai'])
  assert.ok(layout.every((item) => item.span >= 1 && item.span <= 3))
  assert.ok(layout.every((item) => /^1:[123]$/.test(item.state)))
})

test('status and priority stay full-width anchors in every official Home template', () => {
  for (const size of ['small', 'normal', 'large']) {
    const layout = resolveHomeDashboardLayout(HOME_DASHBOARD_CARDS, size)
    assert.equal(layout.find((item) => item.id === 'status')?.span, 3)
    assert.equal(layout.find((item) => item.id === 'priority')?.span, 3)
  }
})

test('Piccolo is dense, Normale balances 1:2 and 1:1, Grande gives full-width detail', () => {
  const small = resolveHomeDashboardLayout(HOME_DASHBOARD_CARDS, 'small')
  const normal = resolveHomeDashboardLayout(HOME_DASHBOARD_CARDS, 'normal')
  const large = resolveHomeDashboardLayout(HOME_DASHBOARD_CARDS, 'large')

  assert.deepEqual(small.slice(2).map((item) => item.span), [1, 1, 1, 1])
  assert.deepEqual(normal.slice(2).map((item) => item.span), [2, 1, 2, 1])
  assert.deepEqual(large.slice(2).map((item) => item.span), [3, 3, 3, 3])
})

test('a single remaining permitted macro-card expands instead of leaving a hole', () => {
  const layout = resolveHomeDashboardLayout(['status', 'structure'], 'normal')
  assert.equal(layout.find((item) => item.id === 'structure')?.span, 3)
})
