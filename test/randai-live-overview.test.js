import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('RandAI overview is wired to real runtime heartbeats', () => {
  const source=fs.readFileSync('src/randai/control/RandAIControlCenter.jsx','utf8')
  assert.match(source,/randcore_agent_runtime/)
  assert.match(source,/randai-overview-live-runtime/)
  assert.match(source,/postgres_changes/)
  assert.match(source,/buildAgentRuntimeBoard/)
  assert.match(source,/Attività ecosistema live/)
  assert.match(source,/latestAgentActivity/)
  assert.doesNotMatch(source,/Math\.random\(|fake heartbeat|simulated online/i)
})
