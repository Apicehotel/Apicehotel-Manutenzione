import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('RandAILive route is isolated and driven by real runtime data',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8')
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const css=fs.readFileSync('src/randai/live/randai-live.css','utf8')
  const engine=fs.readFileSync('src/randai/live/world-engine.js','utf8')
  const scene=fs.readFileSync('src/randai/live/game/RandHotelScene.js','utf8')
  assert.match(main,/\/randailive/)
  assert.match(live,/randcore_agent_runtime/)
  assert.match(live,/postgres_changes/)
  assert.match(live,/buildAgentRuntimeBoard/)
  assert.match(live,/RUNNING/)
  assert.match(engine,/WAITING_APPROVAL/)
  assert.match(engine,/status==='RUNNING'/)
  assert.match(engine,/status==='ERROR'/)
  assert.match(scene,/GridEngine/)
  assert.match(scene,/HotelAgentBrain/)
  assert.match(css,/rl-game-canvas/)
  assert.doesNotMatch(live,/Math\.random\(|fake|simulat/i)
})

test('RandAILive contains all ten canonical runtime agents',()=>{
  const scene=fs.readFileSync('src/randai/live/game/RandHotelScene.js','utf8')
  for(const id of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']) assert.match(scene,new RegExp(id))
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
  const scene=fs.readFileSync('src/randai/live/game/RandHotelScene.js','utf8')
  assert.match(scene,/SALA ATTESA/)
  assert.match(scene,/syncIssues/)
  assert.match(scene,/CLIENT_SLOTS/)
  assert.match(engine,/WANDER/)
  assert.match(css,/rl-game-frame/)
})

test('RandAILive v2 keeps every canonical Rand identity visible in the game world',()=>{
  const scene=fs.readFileSync('src/randai/live/game/RandHotelScene.js','utf8')
  const brain=fs.readFileSync('src/randai/live/game/agent-brain.js','utf8')
  for(const id of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']){
    assert.match(scene+brain,new RegExp(id))
  }
})

test('RandAILive v2.1 keeps mobile game canvas fitted and clients spatially separated',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const engine=fs.readFileSync('src/randai/live/world-engine.js','utf8')
  const css=fs.readFileSync('src/randai/live/randai-live.css','utf8')
  const auth=fs.readFileSync('src/randai/auth/randai-auth.css','utf8')
  assert.match(engine,/CLIENT_SLOTS/)
  assert.match(engine,/waiting:\[/)
  assert.doesNotMatch(live,/--offset/)
  assert.match(css,/aspect-ratio:10\/13/)
  assert.match(css,/min-width:0/)
  assert.match(auth,/ra-tools--live\{display:none\}/)
})


test('RandAILive v3 uses the chosen game stack without changing RandApp ownership',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'))
  const scene=fs.readFileSync('src/randai/live/game/RandHotelScene.js','utf8')
  const brain=fs.readFileSync('src/randai/live/game/agent-brain.js','utf8')
  const map=JSON.parse(fs.readFileSync('public/randailive/maps/hotel-main.json','utf8'))
  assert.equal(pkg.dependencies.phaser,'4.0.0')
  assert.equal(pkg.dependencies['grid-engine'],'2.52.1')
  assert.equal(pkg.dependencies.yuka,'0.7.8')
  assert.equal(lock.packages['node_modules/phaser']?.version,'4.0.0')
  assert.equal(lock.packages['node_modules/grid-engine']?.version,'2.52.1')
  assert.equal(lock.packages['node_modules/yuka']?.version,'0.7.8')
  assert.match(scene,/new Phaser\.Game/)
  assert.match(scene,/gridEngine\.moveTo/)
  assert.match(scene,/PathBlockedStrategy\.RETRY/)
  assert.match(brain,/new StateMachine/)
  assert.match(brain,/WAITING_APPROVAL/)
  assert.equal(map.orientation,'orthogonal')
  assert.equal(map.layers.some((layer)=>layer.name==='zones'&&layer.type==='objectgroup'),true)
})
