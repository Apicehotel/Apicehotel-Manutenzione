import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrimaryBottomNav, withNavigationPlacement, supportsBottomPlacement } from '../src/randapp/shell-navigation.js'

const build = (config, denied = []) => buildPrimaryBottomNav({
  placement: key => config[key] || 'side',
  viewAllowed: id => !denied.includes(id),
  interests: ['communications'],
})

test('an operational shortcut is not displaced by a menu-only chat', () => {
  const items = build({home:'bottom', planning_work:'bottom', chat:'side', housekeeping:'bottom'})
  assert.equal(items.find(item => item.slot === 4)?.id, 'housekeeping')
  assert.equal(items.find(item => item.id === 'home')?.slot, 3)
  assert.equal(items.at(-1).action, 'randai')
})

test('menu-only, hidden and unauthorized destinations stay out of the bar', () => {
  const items = build({home:'side', planning_work:'side', chat:'off', inventory:'bottom'}, ['inventory'])
  assert.deepEqual(items.map(item => item.id), ['operations', 'randai'])
})

test('choosing a shortcut replaces the previous choice, including defaults, without changing other roles', () => {
  const config = {reception:{chat:'bottom', home:'bottom'}, admin:{chat:'bottom'}}
  const next = withNavigationPlacement(config, 'reception', 'supplies', 'bottom', key => config.reception[key] || 'side')
  assert.equal(next.reception.chat, 'side')
  assert.equal(next.reception.supplies, 'bottom')
  assert.equal(next.reception.home, 'bottom')
  assert.equal(next.admin.chat, 'bottom')
  assert.equal(config.reception.chat, 'bottom')
  assert.equal(build(next.reception).find(item => item.slot === 4)?.id, 'supplies')
})

test('only actual primary destinations offer bottom placement', () => {
  for (const key of ['home','planning_work','interventions','chat','inventory','supplies','urgent','housekeeping']) assert.equal(supportsBottomPlacement(key),true)
  for (const key of ['issues','profile','manual','cache','export']) assert.equal(supportsBottomPlacement(key),false)
})
