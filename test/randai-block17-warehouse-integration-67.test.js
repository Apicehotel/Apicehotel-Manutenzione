import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildWarehouseEvidence, RANDAI_WAREHOUSE_EVIDENCE_MAX_PARTS } from '../src/randai/context/warehouse-evidence.js'
import { createInterventionContextEnvelope } from '../src/randai/context/envelope.js'

const adapter = fs.readFileSync(new URL('../src/inventory-intervention-data.js', import.meta.url), 'utf8')
const view = fs.readFileSync(new URL('../src/randapp/operations/InterventionsView.jsx', import.meta.url), 'utf8')
const assistant = fs.readFileSync(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260901112200_inventory_block3_intervention_parts.sql', import.meta.url), 'utf8')

test('warehouse evidence is bounded, hotel-scoped and read-only', () => {
  const parts = Array.from({ length: RANDAI_WAREHOUSE_EVIDENCE_MAX_PARTS + 3 }, (_, index) => ({
    id: `part-${index}`,
    hotelId: index === 0 ? 'chocohotel' : 'hotelgio',
    itemId: `item-${index}`,
    quantity: 1,
    status: index % 2 ? 'reserved' : 'consumed',
  }))
  const items = parts.map((part, index) => ({ id: part.itemId, hotelId: part.hotelId, name: `Ricambio ${index}`, unit: 'pz', minQuantity: 2 }))
  const availability = parts.map((part) => ({ itemId: part.itemId, hotelId: part.hotelId, availableQuantity: 1 }))
  const evidence = buildWarehouseEvidence({ hotelId: 'hotelgio', parts, items, availability })
  assert.equal(evidence.readOnly, true)
  assert.equal(evidence.trust, 'operational_db')
  assert.ok(evidence.parts.length <= RANDAI_WAREHOUSE_EVIDENCE_MAX_PARTS)
  assert.ok(evidence.parts.every((part) => part.name !== 'Ricambio 0'))
  assert.equal(evidence.bounded, true)
})

test('intervention context carries warehouse evidence without issue semantics', () => {
  const envelope = createInterventionContextEnvelope({
    hotelId: 'hotelgio',
    intervention: { id: 'int-1', location: 'Sala A', category: 'Elettrico', status: 'open', notes: 'Sostituire lampada' },
    parts: [{ id: 'p1', hotelId: 'hotelgio', requestedName: 'Lampada', quantity: 1, status: 'requested' }],
  })
  assert.equal(envelope.resource.type, 'intervention')
  assert.equal(envelope.resource.id, 'int-1')
  assert.equal(envelope.resource.warehouse.readOnly, true)
  assert.equal(envelope.screen.view, 'interventions')
})

test('intervention inventory reads require explicit hotel scope', () => {
  assert.match(adapter, /hotelId e interventionId sono obbligatori/)
  assert.match(adapter, /\.eq\('hotel_id', hotelId\)\.eq\('intervention_id', interventionId\)/)
  assert.match(adapter, /\.eq\('hotel_id', hotelId\)\.eq\('item_id', itemId\)/)
  assert.match(view, /fetchInterventionParts\(\{ hotelId: hotel\.id, interventionId: item\.id \}\)/)
  assert.match(view, /subscribeInterventionParts\(\{ hotelId: hotel\.id, interventionId: item\.id \}/)
})

test('request adapter deduplicates concurrent identical part requests without bypassing server RPC', () => {
  assert.match(adapter, /const requestInFlight = new Map\(\)/)
  assert.match(adapter, /if \(requestInFlight\.has\(key\)\) return requestInFlight\.get\(key\)/)
  assert.match(adapter, /supabase\.rpc\('inventory_request_intervention_part'/)
  assert.match(migration, /for update/)
  assert.match(migration, /inventory_consume_intervention_part/)
})

test('RandAI receives warehouse context read-only and keeps issue workspace type-gated', () => {
  assert.match(view, /createInterventionContextEnvelope/)
  assert.match(view, /publishRandAIContext\(context\)/)
  assert.match(view, /clearRandAIContextResource/)
  assert.match(assistant, /activeResource\?\.type === 'issue' \? activeResource : null/)
  assert.doesNotMatch(fs.readFileSync(new URL('../src/randai/context/warehouse-evidence.js', import.meta.url), 'utf8'), /supabase|rpc\(|insert\(|update\(|delete\(/i)
})

test('legacy issue spare text is retained until end-to-end mapping is proven', () => {
  const issues = fs.readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
  assert.match(issues, /pieceNeeded|pieceName/)
  assert.doesNotMatch(issues, /inventory_request_intervention_part/)
})
