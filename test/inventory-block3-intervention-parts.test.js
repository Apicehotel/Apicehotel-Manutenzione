import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260901112200_inventory_block3_intervention_parts.sql', import.meta.url), 'utf8')
const deletePolicy = readFileSync(new URL('../supabase/migrations/20260901113600_inventory_block3_delete_policy_refine.sql', import.meta.url), 'utf8')
const movementIndex = readFileSync(new URL('../supabase/migrations/20260901113000_inventory_block3_movement_index.sql', import.meta.url), 'utf8')
const data = readFileSync(new URL('../src/inventory-intervention-data.js', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/randapp/operations/InterventionsView.jsx', import.meta.url), 'utf8')

test('block 3 links intervention parts to the immutable inventory ledger', () => {
  assert.match(migration, /inventory_intervention_parts/)
  assert.match(migration, /inventory_available_stock/)
  assert.match(migration, /inventory_consume_intervention_part/)
  assert.match(migration, /movement_type[^\n]*reason_code[^\n]*reference_type[^\n]*reference_id/i)
  assert.match(migration, /'consumo'/)
  assert.match(migration, /'intervention_part'/)
  assert.match(migration, /v_row\.intervention_id::text/)
  assert.match(movementIndex, /inventory_intervention_parts_movement_idx/)
})

test('reservations prevent two interventions from claiming the same last stock', () => {
  assert.match(migration, /status='reserved'/)
  assert.match(migration, /available_quantity/)
  assert.match(migration, /INSUFFICIENT_AVAILABLE_STOCK/)
  assert.match(migration, /for update/)
  assert.match(migration, /SERIAL_ALREADY_RESERVED/)
})

test('intervention cannot close with unresolved part requests', () => {
  assert.match(migration, /inventory_guard_intervention_completion/)
  assert.match(migration, /INTERVENTION_PARTS_PENDING/)
  assert.match(view, /partsPending/)
  assert.match(view, /Risolvi prima i ricambi richiesti o prenotati/)
})

test('UI keeps uncatalogued requests as fallback and consumes stock only after explicit use', () => {
  assert.match(view, /Non presente in catalogo/)
  assert.match(view, /Registra richiesta/)
  assert.match(view, />Usato</)
  assert.match(data, /inventory_request_intervention_part/)
  assert.match(data, /inventory_consume_intervention_part/)
  assert.match(data, /inventory_release_intervention_part/)
})

test('only ledger-affecting parts make intervention history immutable', () => {
  assert.match(deletePolicy, /status='consumed'/)
  assert.match(deletePolicy, /INTERVENTION_HAS_INVENTORY_HISTORY/)
  assert.match(deletePolicy, /delete from public\.inventory_intervention_parts/)
  assert.match(deletePolicy, /status<>'consumed'/)
  assert.match(migration, /on delete restrict/i)
})
