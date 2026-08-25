import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRoomType, parseSlopePrivacyRows } from '../src/housekeeping-report.js'

test('normalizza le tipologie operative senza conservare testo libero', () => {
  assert.equal(normalizeRoomType('Camera Superior Jazz'), 'Superior')
  assert.equal(normalizeRoomType('Doppia uso singola Economy'), 'Singola')
  assert.equal(normalizeRoomType('Suite Executive'), 'Suite')
  assert.equal(normalizeRoomType('Accessibile disabili'), 'Accessibile')
})

test('parser Slope applica whitelist e non esporta note/dati ospite', () => {
  const rows = [[
    'Primo piano Jazz',
    'Superior',
    '1104',
    'In partenza',
    '2026-08-25',
    '2026-08-25',
    'Matrimoniale',
    'Matrimoniale',
    'Mario Rossi allergia lattice - testo libero da NON importare',
    'mario@example.com',
    '+39 333 1234567',
  ]]
  const result = parseSlopePrivacyRows(rows, {
    1104: { group:'Jazz P1', roomType:'Superior' },
    1105: { group:'Jazz P1', roomType:'Suite' },
  })
  assert.equal(result.length, 2)
  assert.deepEqual(Object.keys(result[0]).sort(), ['arrivo','camera','gruppo','letti','partenza','stato_slope','tipologia'].sort())
  assert.equal(result[0].camera, '1104')
  assert.equal(result[0].tipologia, 'Superior')
  assert.equal(result[0].stato_slope, 'partenza')
  assert.equal(result[1].tipologia, 'Suite')
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('Mario Rossi'), false)
  assert.equal(serialized.includes('mario@example.com'), false)
  assert.equal(serialized.includes('333'), false)
  assert.equal(serialized.includes('allergia'), false)
})
