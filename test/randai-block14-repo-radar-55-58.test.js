import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'
import { RepoRadarDecision, assertSafeAdoption, buildRepoRadarSnapshot, evaluateRepoCandidate } from '../src/randai/discovery/repo-radar.js'
import { getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

test('55 Repo Radar treats stars as discovery metadata, never as adoption score', () => {
  const base={id:'x',name:'X',repository:'https://github.com/example/x',license:'MIT',maintained:true,gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:.9,maintenance:.9,maturity:.9,tests:.9,compatibility:.9,performance:.9,rollback:.9,maintainability:.9}}
  const low=evaluateRepoCandidate({...base,stars:1})
  const high=evaluateRepoCandidate({...base,stars:999999})
  assert.equal(low.score,high.score)
  assert.equal(low.decision,RepoRadarDecision.ADD)
})

test('56 deep evaluation rejects hard blockers and watches incomplete evidence', () => {
  const rejected=evaluateRepoCandidate({id:'bad',name:'Bad',repository:'https://github.com/example/bad',license:'GPL-3.0',maintained:true,gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:1,maintenance:1,maturity:1,tests:1,compatibility:1,performance:1,rollback:1,maintainability:1}})
  const watch=evaluateRepoCandidate({id:'watch',name:'Watch',repository:'https://github.com/example/watch',license:'MIT',maintained:true,gates:{security:null,compatibility:true,benchmark:null,rollback:true},evidence:{security:.9,maintenance:.9,maturity:.9,tests:.9,compatibility:.9,performance:.9,rollback:.9,maintainability:.9}})
  assert.equal(rejected.decision,RepoRadarDecision.REJECT)
  assert.equal(watch.decision,RepoRadarDecision.WATCH)
})

test('57 replacement requires verified target, measured superiority and every adoption gate', () => {
  const incumbent={id:'old',name:'Old',repository:'https://github.com/example/old',license:'MIT',evidence:{security:.7,maintenance:.7,maturity:.7,tests:.7,compatibility:.7,performance:.7,rollback:.7,maintainability:.7}}
  const candidate={id:'new',name:'New',repository:'https://github.com/example/new',license:'MIT',maintained:true,replaces:'old',gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:.95,maintenance:.95,maturity:.95,tests:.95,compatibility:.95,performance:.95,rollback:.95,maintainability:.95}}
  const report=evaluateRepoCandidate(candidate,{incumbent})
  assert.equal(report.decision,RepoRadarDecision.REPLACE)
  assert.equal(assertSafeAdoption(report),true)
  const noRollback=evaluateRepoCandidate({...candidate,gates:{...candidate.gates,rollback:null}},{incumbent})
  assert.equal(noRollback.decision,RepoRadarDecision.WATCH)
  assert.equal(assertSafeAdoption(noRollback),false)
})

test('58 snapshot never auto-installs and catalog spans governed outcomes', () => {
  const snapshot=buildRepoRadarSnapshot(REPO_RADAR_CATALOG)
  assert.equal(snapshot.policy.starsAreDiscoveryOnly,true)
  assert.equal(snapshot.policy.automaticInstall,false)
  assert.equal(snapshot.policy.automaticReplace,false)
  assert.equal(snapshot.policy.humanApprovalRequired,true)
  for(const decision of [RepoRadarDecision.ADD,RepoRadarDecision.WATCH,RepoRadarDecision.REJECT,RepoRadarDecision.KEEP]) assert.ok(snapshot.candidates.some((item)=>item.decision===decision))
})

test('weekly discovery is read-only, bounded and discovered repos cannot self-promote', () => {
  const workflow=fs.readFileSync('.github/workflows/repo-radar.yml','utf8')
  const runner=fs.readFileSync('scripts/repo-radar-snapshot.mjs','utf8')
  assert.match(workflow,/contents: read/)
  assert.match(workflow,/schedule:/)
  assert.match(workflow,/npm run repo:radar/)
  assert.doesNotMatch(workflow,/npm install .*@latest|npx .*@latest/)
  assert.match(runner,/source:'DISCOVERED'/)
  assert.match(runner,/gates:\{security:null,compatibility:null,benchmark:null,rollback:null\}/)
  assert.match(runner,/slice\(0,15\)/)
})

test('Repo Radar is live in ecosystem only with code UI and weekly evidence', () => {
  const radar=getRandEcosystemManifest().find((item)=>item.id==='reporadar')
  assert.equal(radar.status,'LIVE')
  assert.ok(radar.evidence.includes('src/randai/discovery/repo-radar.js'))
  assert.ok(radar.evidence.includes('src/randai/control/RepoRadarConsole.jsx'))
  assert.ok(radar.evidence.includes('.github/workflows/repo-radar.yml'))
})
