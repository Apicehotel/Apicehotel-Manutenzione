import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI read/mutate issue paths share segnalazioni as the canonical table', async () => {
  const assistant = await read('supabase/functions/randai-assistant/index.ts')
  const workspace = await read('supabase/functions/randai-issue-workspace/index.ts')
  const gateway = await read('supabase/functions/randai-action-gateway/index.ts')
  const priority = await read('supabase/functions/randai-operational-priority/index.ts')
  const issuesData = await read('src/issues-data.js')

  assert.match(issuesData, /from\('segnalazioni'\)/)
  assert.match(gateway, /from\("segnalazioni"\)/)
  assert.match(priority, /from\("segnalazioni"\)/)

  assert.match(assistant, /from\("segnalazioni"\)/)
  assert.doesNotMatch(assistant, /from\("maintenance_issues"\)/)
  assert.match(assistant, /\.is\("deleted_at", null\)/)

  assert.match(workspace, /from\("segnalazioni"\)/)
  assert.doesNotMatch(workspace, /from\("maintenance_issues"\)/)
  assert.match(workspace, /location: data\.camera/)
  assert.match(workspace, /status: data\.stato/)
})

test('Control Center secondary access gate requires role RandAI like ProtectedRoute', async () => {
  const control = await read('src/randai/control/RandAIControlCenter.jsx')
  const route = await read('src/randai/auth/RandAIProtectedRoute.jsx')
  assert.match(route, /\.eq\('role','RandAI'\)/)
  assert.match(control, /\.eq\('role', 'RandAI'\)/)
  assert.match(control, /\.eq\('can_access_admin', true\)/)
})
