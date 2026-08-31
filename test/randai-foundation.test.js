import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { findInternalProcedure } from '../src/randai/knowledge.js'

test('RandAI retrieves the Hotel Giò Jazz cooling procedure', () => {
  const procedure = findInternalProcedure({ hotelId: 'hotelgio', query: 'Al Jazz i condizionatori non freddano' })
  assert.equal(procedure?.id, 'hotelgio-jazz-clima-not-cooling')
  assert.match(procedure.summary, /1° Jazz/)
  assert.match(procedure.summary, /quattro piani Jazz/)
})

test('RandAI never reuses Hotel Giò knowledge in another hotel', () => {
  assert.equal(findInternalProcedure({ hotelId: 'chocohotel', query: 'condizionatori Jazz non freddano' }), null)
  assert.equal(findInternalProcedure({ hotelId: 'brigantino', query: 'condizionatori Jazz non freddano' }), null)
})

test('RandAI is lazy and mounted only for an authenticated normal RandApp runtime', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  assert.match(source, /const RandAIAssistant = lazy\(\(\) => import\('\.\/randai\/RandAIAssistant\.jsx'\)\)/)
  assert.match(source, /function AuthenticatedRandAI\(\)/)
  assert.match(source, /useState\(\(\) => Boolean\(loadSession\(\)\)\)/)
  assert.match(source, /if \(!active\) return null/)
  assert.match(source, /<App \/><AuthenticatedRandAI \/>/)
})
