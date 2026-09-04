import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandAI exposes completed capabilities as a primary product path', () => {
  const control = read('src/randai/control/RandAIControlCenter.jsx')
  const capabilities = read('src/randai/control/CapabilitiesConsole.jsx')

  assert.match(control, /\['capabilities', 'Funzioni'\]/)
  assert.match(control, /capabilities: <CapabilitiesConsole onOpen=\{openSection\}/)
  for (const label of ['Segnalazioni', 'RandGuide', 'RandMind', 'RandBrain', 'Viking', 'Media e manuali']) {
    assert.match(capabilities, new RegExp(label))
  }
  assert.match(capabilities, /RandApp mantiene il PIN operativo separato/)
})

test('RandMind receives the authenticated hotel scope', () => {
  const control = read('src/randai/control/RandAIControlCenter.jsx')
  const ecosystem = read('src/randai/control/EcosystemConsole.jsx')

  assert.match(control, /<EcosystemConsole accessHotels=\{access\.hotels\} hotelFilter=\{hotelFilter\}/)
  assert.match(ecosystem, /<RandMindConsole accessHotels=\{accessHotels\} hotelFilter=\{hotelFilter\}/)
})

test('RandCore health uses a narrow RandAI RPC instead of broadening RandApp admin', () => {
  const health = read('src/randai/control/RandCoreHealthConsole.jsx')
  const migration = read('supabase/migrations/20260904023000_randai_product_completion_access.sql')

  assert.match(health, /randcore_get_health_history_randai/)
  assert.match(health, /randcore_run_health_check_randai/)
  assert.match(migration, /role\s*=\s*'RandAI'/i)
  assert.match(migration, /hm\.active\s*=\s*true/i)
  assert.match(migration, /hm\.can_access_admin\s*=\s*true/i)
  assert.match(migration, /revoke all on function public\.randcore_get_health_history_randai\(integer\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.randcore_get_health_history_randai\(integer\) to authenticated/i)
  assert.doesNotMatch(migration, /create or replace function public\.has_any_randapp_admin/i)
})
