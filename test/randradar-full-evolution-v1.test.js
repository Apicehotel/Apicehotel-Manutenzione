import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildRepoRadarEvolutionInventory, buildRepoRadarSearchProfiles, summarizeRepoRadarEvolutionCoverage, EVOLUTION_COVERAGE_CONTRACT, AI_EVOLUTION_PROFILES } from '../src/randai/discovery/repo-radar-evolution-inventory.js'
import { listRandUiPages } from '../src/randapp/randui/page-catalog.js'
import { getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

test('RandRadar Full Evolution derives coverage from the live app inventory',()=>{
  const inventory=buildRepoRadarEvolutionInventory()
  const pages=listRandUiPages()
  assert.equal(inventory.contract,'RAND_FULL_EVOLUTION_V1')
  assert.equal(inventory.pages.length,pages.length)
  assert.equal(inventory.pages.length,24)
  assert.deepEqual(new Set(inventory.pages.map((item)=>item.id)),new Set(pages.map((item)=>item.id)))
  for(const id of ['issues','chat','housekeeping','supplies','interventions','inventory','planning-work','planning-sale','urgent','temperature','plants','settings','desktop-download','randai']) assert.ok(inventory.pages.some((item)=>item.id===id),`missing page ${id}`)
})

test('RandRadar covers every governed ecosystem module except itself',()=>{
  const inventory=buildRepoRadarEvolutionInventory()
  const expected=getRandEcosystemManifest().filter((item)=>item.id!=='reporadar').map((item)=>item.id)
  assert.deepEqual(new Set(inventory.ecosystem.map((item)=>item.id)),new Set(expected))
})

test('RandAI evolution is broad, explicit and not limited to agents or RAG',()=>{
  const sectors=new Set(AI_EVOLUTION_PROFILES.map((item)=>item.sector))
  for(const sector of ['AI_AGENT_RUNTIME','AI_MODEL_ROUTING','AI_TOOL_USE_MCP','AI_MEMORY','AI_RAG_RETRIEVAL','AI_EVALS','AI_OBSERVABILITY','AI_GUARDRAILS','AI_MULTIMODAL','AI_VOICE','AI_CODING_AGENT','AI_LEARNING','AI_COST_OPTIMIZATION','AI_CONTEXT_ENGINEERING']) assert.ok(sectors.has(sector),`missing AI sector ${sector}`)
})

test('every live inventory item produces a governed search profile',()=>{
  const profiles=buildRepoRadarSearchProfiles()
  const coverage=summarizeRepoRadarEvolutionCoverage(profiles)
  assert.equal(coverage.contract,EVOLUTION_COVERAGE_CONTRACT)
  assert.equal(coverage.complete,true)
  assert.deepEqual(coverage.missingPages,[])
  assert.deepEqual(coverage.missingModules,[])
  assert.deepEqual(coverage.missingAi,[])
  assert.equal(new Set(profiles.map((item)=>item.id)).size,profiles.length)
  assert.ok(profiles.every((item)=>item.inventoryRef&&item.query&&item.github))
})

test('searches follow real page capabilities and preserve the existing adoption gates',()=>{
  const profiles=buildRepoRadarSearchProfiles()
  const housekeeping=profiles.find((item)=>item.inventoryRef==='page:housekeeping')
  const chat=profiles.find((item)=>item.inventoryRef==='page:chat')
  const warehouse=profiles.find((item)=>item.inventoryRef==='page:inventory')
  assert.match(housekeeping.query,/housekeeping/i)
  assert.match(housekeeping.query,/floor-context|room-list/i)
  assert.match(chat.query,/messaging|messages/i)
  assert.match(warehouse.query,/inventory|warehouse/i)
  const runner=fs.readFileSync('scripts/repo-radar-snapshot.mjs','utf8')
  assert.match(runner,/RAND_FULL_EVOLUTION_V1|EVOLUTION_COVERAGE_CONTRACT/)
  assert.match(runner,/buildRepoRadarSearchProfiles/)
  assert.match(runner,/summarizeRepoRadarEvolutionCoverage/)
  assert.match(runner,/gates:\{security:null,compatibility:null,benchmark:null,rollback:null\}/)
  assert.match(runner,/MAX_DISCOVERED=80/)
  assert.match(runner,/MAX_PER_SECTOR=2/)
  assert.match(runner,/RANDUI_SECTORS/)
  assert.match(runner,/GITHUB/)
  assert.match(runner,/GITLAB/)
  assert.match(runner,/CODEBERG/)
  assert.match(runner,/NPM/)
})
