import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assertRandDesignBridge, RANDDESIGN_CONTRACT, RANDDESIGN_TOOLS, RandDesignToolDecision, summarizeRandDesignBridge } from '../src/randai/design/rand-design-bridge.js'
import { assertRepoRadarSourcePolicy, FIGMA_DISCOVERY_FAMILIES, REPO_RADAR_MIN_ECOSYSTEMS, REPO_RADAR_SOURCE_CATALOG, RepoRadarSourceMode, summarizeRepoRadarSourceCoverage } from '../src/randai/discovery/repo-radar-sources.js'

test('RandDesignBridge keeps one primary Figma bridge and no second design-system owner', () => {
  assert.equal(assertRandDesignBridge(),true)
  assert.equal(RANDDESIGN_CONTRACT.owner,'RandUI')
  const primary=RANDDESIGN_TOOLS.filter((tool)=>tool.decision===RandDesignToolDecision.PRIMARY)
  assert.deepEqual(primary.map((tool)=>tool.id),['figma-official-mcp'])
})

test('RandDesignBridge deliberately avoids zombie overlap', () => {
  const storybook=RANDDESIGN_TOOLS.find((tool)=>tool.id==='storybook-figma-sync')
  const consoleMcp=RANDDESIGN_TOOLS.find((tool)=>tool.id==='figma-console-mcp')
  const codeConnect=RANDDESIGN_TOOLS.find((tool)=>tool.id==='figma-code-connect')
  assert.equal(storybook.decision,RandDesignToolDecision.DEFERRED)
  assert.equal(consoleMcp.decision,RandDesignToolDecision.SANDBOX_ONLY)
  assert.equal(codeConnect.decision,RandDesignToolDecision.DEFERRED)
  assert.match(storybook.reason,/Playwright/)
})

test('RandDesignBridge has a complete governed capability surface', () => {
  const summary=summarizeRandDesignBridge()
  assert.ok(summary.toolCount>=7)
  for(const capability of ['FIGMA_READ','FIGMA_WRITE','DESIGN_CONTEXT','DESIGN_TOKEN_SYNC','CODE_COMPONENT_MAPPING','VISUAL_REGRESSION','REVERSE_IMPORT','SCREENSHOT_TO_LAYERS']) assert.ok(summary.capabilities.includes(capability))
})

test('RandRadar multisource rule spans enough ecosystems and source families', () => {
  assert.equal(assertRepoRadarSourcePolicy(),true)
  const coverage=summarizeRepoRadarSourceCoverage()
  assert.ok(coverage.sourceCount>=REPO_RADAR_MIN_ECOSYSTEMS)
  assert.ok(coverage.automatedCount>=4)
  assert.ok(coverage.familyCount>=4)
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='FIGMA_COMMUNITY'))
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='HUGGINGFACE'&&source.mode===RepoRadarSourceMode.AUTOMATED))
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='CRATES'&&source.mode===RepoRadarSourceMode.AUTOMATED))
})

test('Figma discovery cannot regress to only design-to-code', () => {
  for(const family of ['FIGMA_TO_CODE','CODE_TO_FIGMA','SCREENSHOT_TO_FIGMA','MCP_AGENT_BRIDGE','DESIGN_TOKEN_SYNC','STORYBOOK_FIGMA','VISUAL_REGRESSION','ACCESSIBILITY_DESIGN_LINT']) assert.ok(FIGMA_DISCOVERY_FAMILIES.includes(family))
})

test('RandDesignBridge check remains dependency-free and writes a governed artifact', () => {
  const script=fs.readFileSync('scripts/rand-design-bridge-check.mjs','utf8')
  assert.match(script,/artifacts\/randdesign/)
  assert.match(script,/Storybook not required/)
  assert.doesNotMatch(script,/npm install|npx .*@latest/)
})
