import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const supplyData = readFileSync(new URL('../src/supply-data.js', import.meta.url), 'utf8')
const operationalContext = readFileSync(new URL('../src/operational-context.js', import.meta.url), 'utf8')
const supplyApi = readFileSync(new URL('../src/supply-api.js', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../supabase/functions/supply-api/index.ts', import.meta.url), 'utf8')

test('Rifornimenti bypasses PostgREST and RPC for primary reads and writes', () => {
  assert.match(supplyData, /callSupplyApi\('list-products'/)
  assert.match(supplyData, /callSupplyApi\('list-requests'/)
  assert.match(supplyData, /callSupplyApi\('create-request'/)
  assert.match(supplyData, /callSupplyApi\('resolve-item'/)
  assert.match(supplyData, /callSupplyApi\('save-product'/)
  assert.match(supplyData, /callSupplyApi\('delete-product'/)
  assert.doesNotMatch(supplyData, /\.from\('supply_(?:products|requests|request_items)'/)
  assert.doesNotMatch(supplyData, /\.rpc\('supply_/)
})

test('operational floor contexts use the same direct supply API path', () => {
  assert.match(operationalContext, /callSupplyApi\('floor-contexts'/)
  assert.doesNotMatch(operationalContext, /operational_list_floor_contexts/)
})

test('supply API validates Auth bearer then authorizes hotel actions before direct DB work', () => {
  assert.match(edge, /\/auth\/v1\/user/)
  assert.match(edge, /SUPABASE_DB_URL/)
  assert.match(edge, /hotel_memberships/)
  assert.match(edge, /role_permissions/)
  assert.match(edge, /requirePermission/)
  assert.match(edge, /AUTH_REQUIRED/)
  assert.match(edge, /PERMISSION_DENIED/)
})

test('browser supply API sends current access token to a verify-jwt-false edge function', () => {
  assert.match(supplyApi, /supabase\.auth\.getSession\(\)/)
  assert.match(supplyApi, /Authorization:/)
  assert.match(supplyApi, /\/functions\/v1\/supply-api/)
})
