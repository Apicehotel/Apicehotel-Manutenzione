import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const canonical=['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']

test('RandAILive route stays protected and driven by real runtime data',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8')
  const gate=fs.readFileSync('src/randai/auth/RandAIProtectedRoute.jsx','utf8')
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  assert.match(main,/RandAIProtectedRoute mode="live"/)
  assert.match(gate,/mode==='live'/)
  assert.match(live,/randcore_agent_runtime/)
  assert.match(live,/postgres_changes/)
  assert.match(live,/from\('segnalazioni'\)/)
  assert.match(live,/\.eq\('hotel_id',hotelId\)/)
  assert.match(live,/filter:/)
})

test('RandAILive uses melonJS and removes the superseded Phaser stack from dependencies',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'))
  assert.equal(pkg.dependencies.melonjs,'20.6.0')
  assert.equal(pkg.dependencies.phaser,undefined)
  assert.equal(pkg.dependencies['grid-engine'],undefined)
  assert.equal(pkg.dependencies.yuka,undefined)
  assert.equal(lock.packages['node_modules/melonjs']?.version,'20.6.0')
})

test('melon hotel loads the Tiled map and converts collision tiles into navigable A* space',()=>{
  const game=fs.readFileSync('src/randai/live/game/MelonHotelGame.js','utf8')
  const map=JSON.parse(fs.readFileSync('public/randailive/maps/hotel-main.json','utf8'))
  assert.match(game,/Application/)
  assert.match(game,/hotel-main\.json/)
  assert.match(game,/function astar/)
  assert.match(game,/this\.blocked\.add/)
  assert.match(game,/this\.app\.viewport\.follow/)
  assert.match(game,/this\.app\.viewport\.unfollow/)
  assert.equal(map.orientation,'orthogonal')
  assert.equal(map.properties.some(p=>p.name==='collision_contract'),true)
})

test('Tiled collision contract includes walls, office doors, waiting furniture and service areas',()=>{
  const map=JSON.parse(fs.readFileSync('public/randailive/maps/hotel-main.json','utf8'))
  const ground=map.layers.find(l=>l.name==='ground')
  const blocked=ground.data.filter(v=>v===2).length
  assert.ok(blocked>150)
  assert.equal(map.layers.some(l=>l.name==='zones'&&l.type==='objectgroup'),true)
})

test('all ten canonical Rand agents remain visible and behavior uses real runtime statuses',()=>{
  const game=fs.readFileSync('src/randai/live/game/MelonHotelGame.js','utf8')
  for(const id of canonical)assert.match(game,new RegExp(id))
  assert.match(game,/RUNNING/)
  assert.match(game,/WAITING_APPROVAL/)
  assert.match(game,/ERROR/)
  assert.match(game,/SOCIAL/)
})

test('issue clients remain real, hotel scoped and interactive inside the game world',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const wrapper=fs.readFileSync('src/randai/live/game/RandAILiveGame.jsx','utf8')
  const game=fs.readFileSync('src/randai/live/game/MelonHotelGame.js','utf8')
  assert.match(live,/issues={issues}/)
  assert.match(wrapper,/setIssues/)
  assert.match(game,/syncClients/)
  assert.match(game,/new Client/)
  assert.match(game,/onIssue/)
})

test('React shell retains follow selection while melonJS owns camera follow',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const wrapper=fs.readFileSync('src/randai/live/game/RandAILiveGame.jsx','utf8')
  const game=fs.readFileSync('src/randai/live/game/MelonHotelGame.js','utf8')
  assert.match(live,/selectedAgent={selectedAgent}/)
  assert.match(wrapper,/setFollow\(selectedAgent/)
  assert.match(game,/viewport\.follow/)
  assert.match(game,/viewport\.unfollow/)
})
