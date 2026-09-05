import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const seed = readFileSync(
  new URL('../supabase/migrations/20260905170000_seed_hotelgio_supply_catalog.sql', import.meta.url),
  'utf8',
)

const minibar = ['Coca Cola', 'Succo ACE', 'Birra', 'Patatine', 'Barretta']
const consumo = ['Saponetta', 'Shampini', 'Spugne scarpe', 'Cuffia doccia']

test('Hotel Gio receives the complete legacy Minibar and Consumo catalog', () => {
  assert.match(seed, /select 'hotelgio'/)

  for (const name of minibar) {
    assert.match(seed, new RegExp(`\\('minibar'::text, '${name}'::text`))
  }

  for (const name of consumo) {
    assert.match(seed, new RegExp(`\\('consumo'::text, '${name}'::text`))
  }
})

test('legacy bootstrap is idempotent and does not overwrite admin customizations', () => {
  assert.match(seed, /where not exists/i)
  assert.match(seed, /existing\.hotel_id = 'hotelgio'/)
  assert.match(seed, /lower\(existing\.name\) = lower\(p\.name\)/)
  assert.doesNotMatch(seed, /on conflict.*do update/is)
})

test('legacy bootstrap stays inside Rifornimenti and does not seed other hotels or warehouse stock', () => {
  assert.doesNotMatch(seed, /'chocohotel'/)
  assert.doesNotMatch(seed, /'brigantino'/)
  assert.doesNotMatch(seed, /quantity|current_stock|minimum_stock|stock_movement/i)
})
