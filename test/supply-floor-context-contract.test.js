import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260905043000_supply_operational_floor_context.sql', import.meta.url), 'utf8')
const context = readFileSync(new URL('../src/operational-context.js', import.meta.url), 'utf8')
const data = readFileSync(new URL('../src/supply-data.js', import.meta.url), 'utf8')
const portal = readFileSync(new URL('../src/randapp/SupplyRequestsPortal.jsx', import.meta.url), 'utf8')

test('Hotel Gio has one canonical shared Area + Piano source', () => {
  assert.match(migration, /create table if not exists public\.hotel_floor_contexts/)
  for (const area of ['jazz', 'wine']) {
    for (const floor of [1, 2, 3, 4]) {
      assert.match(migration, new RegExp(`\\('hotelgio','${area}','(?:Jazz|Wine)',${floor},'Piano ${floor}'`))
    }
  }
  assert.match(migration, /operational_list_floor_contexts/)
  assert.match(migration, /'supplies','view'/)
  assert.match(migration, /'housekeeping','view'/)
})

test('new supply requests snapshot area and floor and validate them server-side', () => {
  assert.match(migration, /add column if not exists area_code text/)
  assert.match(migration, /add column if not exists area_label text/)
  assert.match(migration, /add column if not exists floor_number integer/)
  assert.match(migration, /add column if not exists floor_label text/)
  assert.match(migration, /supply_create_request_v2/)
  assert.match(migration, /SUPPLY_FLOOR_CONTEXT_REQUIRED/)
  assert.match(migration, /SUPPLY_FLOOR_CONTEXT_INVALID/)
  assert.match(migration, /current_profile_has_phone/)
  assert.match(migration, /hotel_id=p_hotel_id and c\.active/)
})

test('frontend persists active floor per user and hotel for reuse by Housekeeping', () => {
  assert.match(context, /apicehotel\.operational-floor-context\.v1/)
  assert.match(context, /operationalFloorStorageKey/)
  assert.match(context, /userStorageKey/)
  assert.match(context, /localStorage\.getItem/)
  assert.match(context, /localStorage\.setItem/)
  assert.match(context, /operational_list_floor_contexts/)
})

test('Rifornimenti uses the v2 RPC and shows Cambia piano plus destination on requests', () => {
  assert.match(data, /supply_create_request_v2/)
  assert.match(data, /p_area_code/)
  assert.match(data, /p_floor_number/)
  assert.match(data, /area_code,area_label,floor_number,floor_label/)
  assert.match(portal, /Cambia piano/)
  assert.match(portal, /Dove serve\?/)
  assert.match(portal, /P\{context\.floor_number\}/)
  assert.match(portal, /requestContextLabel/)
  assert.match(portal, /Seleziona il piano di consegna/)
})

test('floor selection does not reintroduce the old quantity ledger or warehouse movements', () => {
  assert.doesNotMatch(migration, /stock_movement|current_stock|minimum_stock/i)
  assert.doesNotMatch(portal, /Azzera Piano|Auto-save|current_stock|stock_movement/i)
  assert.match(portal, /Non ci sono quantità/)
})

test('legacy requests remain compatible and unconfigured hotels are not blocked', () => {
  assert.match(migration, /add column if not exists area_code text/)
  assert.doesNotMatch(migration, /area_code text not null/i)
  assert.match(migration, /elsif exists\(select 1 from public\.hotel_floor_contexts/)
  assert.match(migration, /la RPC v1 resta disponibile/i)
})
