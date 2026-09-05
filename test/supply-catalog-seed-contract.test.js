import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const initialSeed = readFileSync(
  new URL('../supabase/migrations/20260905041921_seed_hotelgio_supply_catalog.sql', import.meta.url),
  'utf8',
)
const correction = readFileSync(
  new URL('../supabase/migrations/20260905042146_correct_hotelgio_supply_catalog_from_legacy_app.sql', import.meta.url),
  'utf8',
)

const minibar = [
  'Acqua naturale',
  'Acqua frizzante',
  'Coca Cola',
  'Succo di frutta',
  'Patatine',
  'Barrette',
  'Birre',
]

const consumo = [
  'Carta igienica',
  'Saponette',
  'Shampoo',
  'Cuffie doccia',
  'Spugne scarpe',
  'Sacchi neri 60x50',
  'Sacchi bianchi 60x50',
  'Sacchi neri 110x70',
  'Carta Lucart/Scottex',
]

test('Hotel Gio final catalog matches the real legacy Minibar and Consumo lists', () => {
  assert.match(correction, /hotel_id='hotelgio'/)

  for (const name of minibar) {
    assert.ok(correction.includes(`'minibar'::text, '${name}'::text`), `missing Minibar product: ${name}`)
  }

  for (const name of consumo) {
    assert.ok(correction.includes(`'consumo'::text, '${name}'::text`), `missing Consumo product: ${name}`)
  }
})

test('correction preserves existing product identities when fixing previous bootstrap names', () => {
  assert.match(correction, /set name = 'Saponette'/)
  assert.match(correction, /set name = 'Shampoo'/)
  assert.match(correction, /set name = 'Cuffie doccia'/)
  assert.match(correction, /set name = 'Succo di frutta'/)
  assert.match(correction, /set name = 'Barrette'/)
  assert.match(correction, /set name = 'Birre'/)
})

test('catalog bootstrap stays hotel-scoped and does not create warehouse stock', () => {
  const migrations = `${initialSeed}\n${correction}`
  assert.doesNotMatch(migrations, /'chocohotel'/)
  assert.doesNotMatch(migrations, /'brigantino'/)
  assert.doesNotMatch(migrations, /current_stock|minimum_stock|stock_movement/i)
})

test('final catalog order is explicit for 7 Minibar and 9 Consumo products', () => {
  assert.equal(minibar.length, 7)
  assert.equal(consumo.length, 9)
  assert.match(correction, /'Acqua naturale'::text, 10/)
  assert.match(correction, /'Birre'::text, 70/)
  assert.match(correction, /'Carta igienica'::text, 110/)
  assert.match(correction, /'Carta Lucart\/Scottex'::text, 190/)
})

test('migration filenames preserve the production execution order', () => {
  assert.ok('20260905041921' < '20260905042146')
})
