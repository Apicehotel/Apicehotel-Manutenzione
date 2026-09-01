import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260901105000_inventory_block2_traceability_stocktake_transfer.sql', import.meta.url), 'utf8')
const data = readFileSync(new URL('../src/inventory-block2-data.js', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/randapp/InventoryBlock2Panel.jsx', import.meta.url), 'utf8')
const qr = readFileSync(new URL('../supabase/functions/inventory-qr-label/index.ts', import.meta.url), 'utf8')

test('block 2 keeps one stock ledger and adds traceability layers', () => {
  assert.match(migration, /inventory_serial_units/)
  assert.match(migration, /inventory_compatibility/)
  assert.match(migration, /inventory_stocktakes/)
  assert.match(migration, /inventory_transfers/)
  assert.match(migration, /inventory_finalize_stocktake/)
  assert.match(migration, /movement_type,note/)
})

test('cross-hotel transfer is dispatched and received through guarded RPCs', () => {
  assert.match(migration, /inventory_start_transfer/)
  assert.match(migration, /inventory_receive_transfer/)
  assert.match(migration, /catalog_key/)
  assert.match(migration, /has_app_permission\(v_t\.destination_hotel_id,'inventory','edit'\)/)
  assert.match(migration, /revoke all on function/)
})

test('scanner and QR labels have device-safe fallbacks', () => {
  assert.match(view, /BarcodeDetector/)
  assert.match(view, /USB\/Bluetooth/)
  assert.match(view, /Fotocamera di sistema/)
  assert.match(data, /inventoryCode/)
  assert.match(qr, /qrcode@1\.5\.4/)
  assert.match(qr, /verify/i)
})
