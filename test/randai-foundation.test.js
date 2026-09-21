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

test('RandAI chat page is lazy and mounted inside the authenticated Shell', async () => {
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
  assert.match(shell, /const RandAIAssistant = lazy\(\(\) => import\('\.\.\/randai\/RandAIAssistant\.jsx'\)\)/)
  assert.match(shell, /variant="page"/)
  assert.doesNotMatch(main, /RandAIAssistant/)
  assert.match(main, /function AuthenticatedRandAI\(\)/)
  assert.match(main, /useState\(\(\) => Boolean\(loadSession\(\)\)\)/)
  assert.match(main, /if \(!active\) return null/)
  assert.match(main, /<App \/><AuthenticatedRandAI \/>/)
})
