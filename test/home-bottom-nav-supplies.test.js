import test from 'node:test'
import assert from 'node:assert/strict'
import { PRIMARY_OPERATIONAL_NAV, buildPrimaryBottomNav } from '../src/randapp/shell-navigation.js'

test('Rifornimenti is never promoted into the primary bottom bar', () => {
  assert.equal(PRIMARY_OPERATIONAL_NAV.some((item) => item.id === 'supplies'), false)

  const placement = (key) => key === 'supplies' ? 'bottom' : key === 'home' ? 'bottom' : 'off'
  const viewAllowed = (view) => ['home', 'supplies'].includes(view)
  const items = buildPrimaryBottomNav({ placement, viewAllowed, interests: ['supplies'] })

  assert.equal(items.some((item) => item.id === 'supplies'), false)
  assert.equal(items.some((item) => item.id === 'home'), true)
  assert.equal(items.some((item) => item.id === 'randai'), true)
})
