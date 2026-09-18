import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const panel = fs.readFileSync(new URL('../src/randai/control/AgentControlPanel.jsx', import.meta.url), 'utf8')
const control = fs.readFileSync(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const baseMigration = fs.readFileSync(new URL('../supabase/migrations/20260917235000_randcore_agent_runtime.sql', import.meta.url), 'utf8')
const expandMigration = fs.readFileSync(new URL('../supabase/migrations/20260918043000_expand_randcore_agent_runtime.sql', import.meta.url), 'utf8')

test('control center exposes Agenti IA as a primary section', () => {
  assert.match(control, /\['agents', 'Agenti IA'\]/)
  assert.match(control, /agents: <AgentControlPanel \/>/)
})

test('agent panel uses the canonical runtime table and separates modules from runtime agents', () => {
  assert.match(panel, /randcore_agent_runtime/)
  assert.match(panel, /buildAgentRuntimeBoard/)
  assert.match(panel, /RAND_MODULES/)
  assert.match(panel, /postgres_changes/)
  assert.match(panel, /desired_state/)
  assert.match(panel, /non hanno un processo autonomo/)
})

test('agent runtime persistence remains RLS protected', () => {
  assert.match(baseMigration, /enable row level security/i)
  assert.match(baseMigration, /has_any_randapp_admin\(\)/)
  assert.match(baseMigration, /randai_is_global_admin\(\)/)
})

test('runtime expansion adds Brain and Research without editing the applied base migration', () => {
  for (const id of ['randbrain','randresearch']) assert.match(expandMigration, new RegExp(`'${id}'`))
  assert.match(expandMigration, /drop constraint if exists randcore_agent_runtime_known_agent/i)
  assert.match(expandMigration, /add constraint randcore_agent_runtime_known_agent/i)
  assert.match(expandMigration, /Non-runtime Rand components stay in the ecosystem registry/i)
})
