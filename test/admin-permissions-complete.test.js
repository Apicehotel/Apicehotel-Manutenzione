import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin permission model includes every admin module', async () => {
  const permissions = await source('src/permissions.js')
  for (const module of ['users','role_permissions','app_settings','sensors','usage','diagnostics']) {
    assert.match(permissions, new RegExp(`['\"]${module}['\"]`))
  }
})

test('admin settings editor exposes sensors usage and diagnostics', async () => {
  const constants = await source('src/randapp/admin/settings-constants.js')
  assert.match(constants, /\['sensors','Sensori'\]/)
  assert.match(constants, /\['usage','Consumi'\]/)
  assert.match(constants, /\['diagnostics','Diagnostica'\]/)
})

test('sale planning authorization uses permission matrix instead of role names', async () => {
  const saleUtils = await source('src/randapp/planning/sale-utils.js')
  assert.match(saleUtils, /canUser\(user,'planning_sale','view'\)/)
  assert.match(saleUtils, /canUser\(user,'planning_sale','manage'\)/)
  assert.doesNotMatch(saleUtils, /direttore centro congressi/)
  assert.doesNotMatch(saleUtils, /norm\(user\?\.role\)==='manutentore'/)
})

test('admin navigation uses dedicated sensors and usage permissions', async () => {
  const nav = await source('src/randapp/nav.js')
  assert.match(nav, /canUser\(user, 'sensors', 'manage'\)/)
  assert.match(nav, /canUser\(user, 'usage', 'view'\)/)
})
