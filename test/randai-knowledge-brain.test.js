import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI uses a protected hotel-scoped brain with procedures equipment history and manuals', async () => {
  const data = await read('src/randai/randai-data.js')
  const assistant = await read('src/randai/RandAIAssistant.jsx')
  const edge = await read('supabase/functions/randai-assistant/index.ts')
  const knowledgeMigration = await read('supabase/migrations/20260829080500_randai_knowledge_brain.sql')
  const manualMigration = await read('supabase/migrations/20260829082000_randai_manual_knowledge.sql')

  assert.match(data, /functions\.invoke\('randai-assistant'/)
  assert.match(data, /hotel_id: hotelId/)
  assert.match(edge, /hotel_memberships/)
  assert.match(edge, /\.eq\("hotel_id", hotelId\)/)
  assert.match(edge, /\.eq\("status", "approved"\)/)
  assert.match(edge, /randai_equipment_serves/)
  assert.match(edge, /maintenance_issues/)
  assert.match(edge, /interventi/)
  assert.match(edge, /Promise\.all/)

  assert.match(assistant, /retrieveRandAIGuidance/)
  assert.match(assistant, /Impianto collegato/)
  assert.match(assistant, /Storico RandApp correlato/)
  assert.match(assistant, /Non improvviso/)

  assert.match(knowledgeMigration, /enable row level security/i)
  assert.match(knowledgeMigration, /is_hotel_member\(hotel_id\)/)
  assert.match(knowledgeMigration, /hotelgio-jazz-ac-outdoor-01/)
  assert.match(knowledgeMigration, /4° Jazz/)

  assert.match(manualMigration, /randai_documents/)
  assert.match(manualMigration, /randai_document_chunks/)
  assert.match(manualMigration, /randai_search_document_chunks/)
  assert.match(manualMigration, /grant execute .* service_role/i)
})
