import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { channelOperationalState, normalizeWhatsAppNumber, publicChannelSnapshot, resolveInboundChannel } from '../supabase/functions/_shared/whatsapp-policy.js'

const rows = [
  { hotel_id: 'hotelgio', inbound_number: '+390759978247', receive_enabled: true, ingestion_enabled: true },
  { hotel_id: 'chocohotel', inbound_number: '+390759970610', receive_enabled: true, ingestion_enabled: false },
  { hotel_id: 'brigantino', inbound_number: null, receive_enabled: false, ingestion_enabled: false },
]

test('WP1 normalizes Twilio destinations without changing hotel identity', () => {
  assert.equal(normalizeWhatsAppNumber('whatsapp:+390759978247'), '+390759978247')
  assert.equal(normalizeWhatsAppNumber('0759970610'), '+390759970610')
  assert.equal(normalizeWhatsAppNumber(''), null)
})

test('WP1 routes Giò and Choco independently and never falls back to Brigantino', () => {
  const gio = resolveInboundChannel(rows, '+390759978247')
  const choco = resolveInboundChannel(rows, '+390759970610')
  const brig = resolveInboundChannel(rows, '+390000000000')
  assert.equal(gio.ok, true)
  assert.equal(gio.channel.hotel_id, 'hotelgio')
  assert.equal(gio.reason, 'ACTIVE')
  assert.equal(choco.ok, true)
  assert.equal(choco.channel.hotel_id, 'chocohotel')
  assert.equal(choco.reason, 'PAUSED')
  assert.equal(brig.ok, false)
  assert.equal(brig.reason, 'CHANNEL_NOT_FOUND')
})

test('WP1 fails closed for duplicate or disabled channel routes', () => {
  const duplicate = resolveInboundChannel([rows[0], { ...rows[0], hotel_id: 'chocohotel' }], '+390759978247')
  assert.equal(duplicate.ok, false)
  assert.equal(duplicate.reason, 'AMBIGUOUS_CHANNEL')
  const disabled = resolveInboundChannel([{ ...rows[0], receive_enabled: false }], '+390759978247')
  assert.equal(disabled.ok, false)
  assert.equal(disabled.reason, 'DISABLED')
})

test('WP1 channel snapshots expose operational state but no provider secrets', () => {
  const snapshot = publicChannelSnapshot({ ...rows[0], auth_token: 'secret', account_sid: 'secret', updated_at: 'now' })
  assert.deepEqual(Object.keys(snapshot).sort(), ['hotel_id','inbound_number','ingestion_enabled','receive_enabled','state','updated_at'].sort())
  assert.equal(snapshot.state, 'ACTIVE')
  assert.equal(channelOperationalState(rows[1]), 'PAUSED')
  assert.equal(channelOperationalState(rows[2]), 'NOT_CONFIGURED')
})

test('WP1 inbound edge uses canonical DB routing, proxy trust, quota and DB locations', async () => {
  const edge = await readFile(new URL('../supabase/functions/randai-whatsapp-inbound/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /resolveInboundChannel/)
  assert.match(edge, /WHATSAPP_INBOUND_SHARED_SECRET/)
  assert.match(edge, /consume_whatsapp_inbound_quota/)
  assert.match(edge, /housekeeping_import_rooms/)
  assert.match(edge, /inventory_locations/)
  assert.doesNotMatch(edge, /GIO_ROOMS|CHOCO_ROOMS|BRIG_ROOMS|ALLOWED_PROXY_URL/)
  assert.doesNotMatch(edge, /apicehotel\.vercel\.app/)
})

test('WP1 quota migration is service-role only and hotel-scoped', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260903082500_whatsapp_wp1_inbound_guardrails.sql', import.meta.url), 'utf8')
  assert.match(sql, /primary key \(hotel_id, sender_key\)/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /revoke all on function public\.consume_whatsapp_inbound_quota[^;]+from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.consume_whatsapp_inbound_quota[^;]+to service_role/i)
  assert.doesNotMatch(sql, /whatsapp_channel_settings_inbound_number_not_null_uidx/)
})
