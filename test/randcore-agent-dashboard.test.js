import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const panel = fs.readFileSync(new URL('../src/randai/control/AgentControlPanel.jsx', import.meta.url), 'utf8')
const control = fs.readFileSync(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917235000_randcore_agent_runtime.sql', import.meta.url), 'utf8')

test('control center exposes Agenti IA as a primary section', () => {
  assert.match(control, /\['agents', 'Agenti IA'\]/)
  assert.match(control, /agents: <AgentControlPanel \/>/)
})

test('agent panel uses the canonical runtime table and registry', () => {
  assert.match(panel, /randcore_agent_runtime/)
  assert.match(panel, /buildAgentRuntimeBoard/)
  assert.match(panel, /postgres_changes/)
  assert.match(panel, /desired_state/)
})

test('agent runtime persistence is RLS protected and constrained to canonical agents', () => {
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /has_any_randapp_admin\(\)/)
  assert.match(migration, /randai_is_global_admin\(\)/)
  for (const id of ['randai','randradar','randui','randtest','randsecure','randops','randcore','randmind']) assert.match(migration, new RegExp(`'${id}'`))
})
