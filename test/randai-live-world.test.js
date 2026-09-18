import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('RandAILive route is isolated and driven by real runtime data',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8')
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  const css=fs.readFileSync('src/randai/live/randai-live.css','utf8')
  assert.match(main,/\/randailive/)
  assert.match(live,/randcore_agent_runtime/)
  assert.match(live,/postgres_changes/)
  assert.match(live,/buildAgentRuntimeBoard/)
  assert.match(live,/RUNNING/)
  assert.match(live,/WAITING_APPROVAL/)
  assert.match(css,/rl-agent--running/)
  assert.match(css,/rl-agent--error/)
  assert.match(css,/rlTravel/)
  assert.doesNotMatch(live,/Math\.random\(|fake|simulat/i)
})

test('RandAILive contains all ten canonical runtime agents',()=>{
  const live=fs.readFileSync('src/randai/live/RandAILive.jsx','utf8')
  for(const id of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']) assert.match(live,new RegExp(id))
})
