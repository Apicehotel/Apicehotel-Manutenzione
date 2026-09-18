import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('RandAILive route is isolated and driven by real runtime data',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8')
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const css=fs.readFileSync('src/randai/live/randai-live.css','utf8')
  const engine=fs.readFileSync('src/randai/live/world-engine.js','utf8')
  assert.match(main,/\/randailive/)
  assert.match(live,/randcore_agent_runtime/)
  assert.match(live,/postgres_changes/)
  assert.match(live,/buildAgentRuntimeBoard/)
  assert.match(live,/RUNNING/)
  assert.match(engine,/WAITING_APPROVAL/)
  assert.match(engine,/status==='RUNNING'/)
  assert.match(engine,/status==='ERROR'/)
  assert.match(css,/transition:left 1\.2s ease,top 1\.2s ease/)
  assert.match(css,/rlBob/)
  assert.doesNotMatch(live,/Math\.random\(|fake|simulat/i)
})

test('RandAILive contains all ten canonical runtime agents',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  for(const id of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']) assert.match(live,new RegExp(id))
})

test('RandAILive stays inside RandApp and uses the RandAI access gate',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8')
  const gate=fs.readFileSync('src/randai/auth/RandAIProtectedRoute.jsx','utf8')
  assert.match(main,/RandAIProtectedRoute mode="live"/)
  assert.doesNotMatch(main,/lazy\(\(\) => import\('\.\/randai\/live\/RandAILive\.jsx'\)\)/)
  assert.match(gate,/mode='control'/)
  assert.match(gate,/mode==='live'/)
  assert.match(gate,/RandAILive/)
})

test('RandAILive v2 maps real hotel issues to scoped client NPCs',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const engine=fs.readFileSync('src/randai/live/world-engine.js','utf8')
  const css=fs.readFileSync('src/randai/live/randai-live.css','utf8')
  assert.match(live,/from\('segnalazioni'\)/)
  assert.match(live,/\.eq\('hotel_id',hotelId\)/)
  assert.match(live,/filter:\`hotel_id=eq\.\$\{hotelId\}\`/)
  assert.match(live,/SALA ATTESA/)
  assert.match(live,/ClientNpc/)
  assert.match(engine,/clientState/)
  assert.match(engine,/issueIcon/)
  assert.match(engine,/WANDER/)
  assert.match(css,/rl-waiting/)
  assert.match(css,/rl-client/)
})

test('RandAILive v2 keeps every canonical Rand identity visible in the game world',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const engine=fs.readFileSync('src/randai/live/world-engine.js','utf8')
  for(const id of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']){
    assert.match(live+engine,new RegExp(id))
  }
})
