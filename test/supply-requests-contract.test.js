import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260901123549_supplies_housekeeping_requests.sql', import.meta.url), 'utf8')
const data = readFileSync(new URL('../src/supply-data.js', import.meta.url), 'utf8')
const portal = readFileSync(new URL('../src/randapp/SupplyRequestsPortal.jsx', import.meta.url), 'utf8')
const host = readFileSync(new URL('../src/randapp/HousekeepingCompletionAlerts.jsx', import.meta.url), 'utf8')

test('supply catalog is hotel scoped and limited to Minibar and Consumo', () => {
  assert.match(migration, /category in \('minibar','consumo'\)/)
  assert.match(migration, /unique \(hotel_id,id\)/)
  assert.match(migration, /supply_products_hotel_name_uq/)
  assert.match(portal, /Minibar/)
  assert.match(portal, /Consumo/)
})

test('a requested product has only pending, delivered or missing states', () => {
  assert.match(migration, /status in \('pending','delivered','missing'\)/)
  assert.match(portal, /pending: 'In attesa'/)
  assert.match(portal, /delivered: 'Consegnato'/)
  assert.match(portal, /missing: 'Manca'/)
  assert.doesNotMatch(portal, /Niente/)
})

test('governanti create requests and manutentori resolve them through controlled RPCs', () => {
  assert.match(migration, /'Governante','supplies','create',true/)
  assert.match(migration, /'Capo Governante','supplies','create',true/)
  assert.match(migration, /'manutentore','supplies','complete',true/)
  assert.match(migration, /revoke insert,update,delete on public\.supply_requests from authenticated/)
  assert.match(migration, /revoke insert,update,delete on public\.supply_request_items from authenticated/)
  assert.match(data, /supply_create_request/)
  assert.match(data, /supply_resolve_item/)
})

test('request creation validates active products and item resolution accepts only delivered or missing', () => {
  assert.match(migration, /active and id=any\(p_product_ids\)/)
  assert.match(migration, /SUPPLY_PRODUCT_INVALID/)
  assert.match(migration, /p_status not in\('delivered','missing'\)/)
  assert.match(migration, /SUPPLY_STATUS_INVALID/)
})

test('request closes automatically only when no pending product remains', () => {
  assert.match(migration, /not exists\(select 1 from public\.supply_request_items i where i\.request_id=v_request and i\.status='pending'\)/)
  assert.match(portal, /request\.completed_at \? 'Completata' : 'Aperta'/)
})

test('catalog management is admin-only at the database boundary and preserves historical products', () => {
  assert.match(migration, /'admin','supplies','manage',true/)
  assert.match(migration, /supply_products_manage_delete/)
  assert.match(migration, /on delete restrict/)
  assert.match(portal, /Disattiva/)
  assert.match(portal, /Riattiva/)
  assert.match(portal, /Elimina/)
})

test('rifornimenti update through Supabase realtime rather than polling workers', () => {
  assert.match(data, /postgres_changes/)
  assert.match(data, /table: 'supply_requests'/)
  assert.match(data, /table: 'supply_request_items'/)
  assert.match(data, /table: 'supply_products'/)
  assert.doesNotMatch(data, /setInterval|setTimeout/)
})

test('global housekeeping host exposes the portal without changing reception completion alerts', () => {
  assert.match(host, /SupplyRequestsPortal/)
  assert.match(host, /HousekeepingCompletionAlerts/)
  assert.match(host, /housekeeping-completion-alert/)
})
