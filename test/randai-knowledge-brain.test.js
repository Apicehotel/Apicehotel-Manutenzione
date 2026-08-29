import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI retrieves approved hotel-scoped procedures and linked equipment', async () => {
  const data = await read('src/randai/randai-data.js')
  const assistant = await read('src/randai/RandAIAssistant.jsx')
  const migration = await read('supabase/migrations/20260829080500_randai_knowledge_brain.sql')

  assert.match(data, /from\('randai_procedures'\)/)
  assert.match(data, /\.eq\('hotel_id', hotelId\)/)
  assert.match(data, /\.eq\('status', 'approved'\)/)
  assert.match(data, /randai_equipment_serves/)
  assert.match(data, /Promise\.all/)

  assert.match(assistant, /retrieveRandAIGuidance/)
  assert.match(assistant, /Impianto collegato/)
  assert.match(assistant, /Non improvviso/)

  assert.match(migration, /enable row level security/i)
  assert.match(migration, /is_hotel_member\(hotel_id\)/)
  assert.match(migration, /hotelgio-jazz-ac-outdoor-01/)
  assert.match(migration, /4° Jazz/)
})
