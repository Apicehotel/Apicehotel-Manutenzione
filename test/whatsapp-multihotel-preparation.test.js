import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolveInboundChannel } from '../supabase/functions/_shared/whatsapp-policy.js'

const preparedChannels = [
  { hotel_id: 'hotelgio', inbound_number: '+390759978247', receive_enabled: false, ingestion_enabled: false },
  { hotel_id: 'chocohotel', inbound_number: '+390759970610', receive_enabled: false, ingestion_enabled: false },
  { hotel_id: 'brigantino', inbound_number: null, receive_enabled: false, ingestion_enabled: false },
]

test('all three hotel channels are prepared but paused', () => {
  assert.deepEqual(preparedChannels.map((row) => row.hotel_id), ['hotelgio', 'chocohotel', 'brigantino'])
  assert.equal(preparedChannels.every((row) => row.receive_enabled === false && row.ingestion_enabled === false), true)
  assert.equal(resolveInboundChannel(preparedChannels, '+390759978247').ok, false)
  assert.equal(resolveInboundChannel(preparedChannels, '+390759970610').ok, false)
  assert.equal(resolveInboundChannel(preparedChannels, '+390000000000').ok, false)
})

test('preparation migration preserves only the known Giò and Choco numbers', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260904120000_whatsapp_multihotel_receiving_preparation.sql', import.meta.url), 'utf8')
  assert.match(sql, /\('hotelgio', '\+390759978247', false, false/i)
  assert.match(sql, /\('chocohotel', '\+390759970610', false, false/i)
  assert.match(sql, /\('brigantino', null, false, false/i)
  assert.match(sql, /receive_enabled = false/i)
  assert.match(sql, /ingestion_enabled = false/i)
})
