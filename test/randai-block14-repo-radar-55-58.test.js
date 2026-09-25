import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'
import { RepoRadarDecision, RepoRadarUsageMode, assertSafeAdoption, buildRepoRadarSnapshot, evaluateRepoCandidate, validateRepoRadarCandidate } from '../src/randai/discovery/repo-radar.js'
import { REPO_RADAR_MIN_ECOSYSTEMS, REPO_RADAR_SOURCE_CATALOG, assertRepoRadarSourcePolicy, summarizeRepoRadarSourceCoverage } from '../src/randai/discovery/repo-radar-sources.js'
import { getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

test('55 Repo Radar treats stars as discovery metadata, never as adoption score', () => {
  const base={id:'x',name:'X',repository:'https://github.com/example/x',license:'MIT',maintained:true,gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:.9,maintenance:.9,maturity:.9,tests:.9,compatibility:.9,performance:.9,rollback:.9,maintainability:.9}}
  const low=evaluateRepoCandidate({...base,stars:1})
  const high=evaluateRepoCandidate({...base,stars:999999})
  assert.equal(low.score,high.score)
  assert.equal(low.decision,RepoRadarDecision.ADD)
})

test('56 deep evaluation rejects hard blockers but keeps copyleft available for governed internal evaluation', () => {
  const unknown=evaluateRepoCandidate({id:'bad',name:'Bad',repository:'https://github.com/example/bad',license:'Proprietary-Unknown',maintained:true,gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:1,maintenance:1,maturity:1,tests:1,compatibility:1,performance:1,rollback:1,maintainability:1}})
  const copyleft=evaluateRepoCandidate({id:'gpl',name:'GPL Tool',repository:'https://github.com/example/gpl',license:'GPL-3.0',usageMode:RepoRadarUsageMode.INTERNAL_EVALUATION,maintained:true,gates:{security:true,compatibility:true,benchmark:true,rollback:true},evidence:{security:1,maintenance:1,maturity:1,tests:1,compatibility:1,performance:1,rollback:1,maintainability:1}})
  const watch=evaluateRepoCandidate({id:'watch',name:'Watch',repository:'https://github.com/example/watch',license:'MIT',maintained:true,gates:{security:null,compatibility:true,benchmark:null,rollback:true},evidence:{security:.9,maintenance:.9,maturity:.9,tests:.9,compatibility:.9,performance:.9,rollback:.9,maintainability:.9}})
  assert.equal(unknown.decision,RepoRadarDecision.REJECT)
  assert.equal(copyleft.decision,RepoRadarDecision.WATCH)
  assert.equal(copyleft.reason,'LICENSE_REVIEW_REQUIRED')
  assert.equal(copyleft.licenseReviewRequired,true)
  assert.equal(assertSafeAdoption(copyleft),false)
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
  assert.equal(snapshot.policy.multiSourceDiscovery,true)
  assert.equal(snapshot.policy.sectorCoverage,true)
  assert.equal(snapshot.policy.internalNonCommercialContext,true)
  assert.equal(snapshot.policy.copyleftRequiresUsageBoundary,true)
  for(const decision of [RepoRadarDecision.ADD,RepoRadarDecision.WATCH,RepoRadarDecision.REJECT,RepoRadarDecision.KEEP]) assert.ok(snapshot.candidates.some((item)=>item.decision===decision))
})

test('Repo Radar accepts governed forge and specialist source hosts and rejects arbitrary hosts', () => {
  for(const repository of [
    'https://github.com/example/repo',
    'https://gitlab.com/example/repo',
    'https://codeberg.org/example/repo',
    'https://gitea.com/example/repo',
    'https://code.forgejo.org/example/repo',
    'https://bitbucket.org/example/repo',
    'https://git.sr.ht/~example/repo',
    'https://gitee.com/example/repo',
    'https://huggingface.co/spaces/example/repo',
    'https://open-vsx.org/extension/example/repo',
  ]) assert.equal(validateRepoRadarCandidate({id:repository,name:'Repo',repository}),true)
  assert.throws(()=>validateRepoRadarCandidate({id:'bad-host',name:'Bad',repository:'https://example.com/repo/code'}),/Unsupported repository URL/)
})

test('fortnightly discovery is read-only, bounded, multisource and RANDUI_100_V1 sector-complete', () => {
  const workflow=fs.readFileSync('.github/workflows/repo-radar.yml','utf8')
  const runner=fs.readFileSync('scripts/repo-radar-snapshot.mjs','utf8')
  assert.match(workflow,/contents: read/)
  assert.match(workflow,/schedule:/)
  assert.match(workflow,/npm run repo:radar/)
  assert.doesNotMatch(workflow,/npm install .*@latest|npx .*@latest/)
  assert.match(runner,/source:'DISCOVERED'/)
  assert.match(runner,/gates:\{security:null,compatibility:null,benchmark:null,rollback:null\}/)
  assert.match(runner,/MAX_DISCOVERED=80/)
  assert.match(runner,/MAX_PER_SECTOR=2/)
  assert.match(runner,/MIN_ACCEPTABLE_COVERAGE=0\.80/)
  assert.match(runner,/SCAN_BUDGET_MS=18\*60\*1000/)
  assert.match(runner,/operationalSuccess/)
  assert.match(runner,/stoppedByBudget/)
  assert.match(runner,/RANDUI_COVERAGE_CONTRACT='RANDUI_100_V1'/)
  assert.match(runner,/RANDUI_SECTORS/)
  const sectors=[
    'FOUNDATION_LAYOUT','SHELL_NAVIGATION','PAGE_TEMPLATES','DASHBOARD_KPI','DATA_TABLES','MASTER_DETAIL',
    'MOBILE_OPERATIONAL','PLANNING_CALENDAR','FORMS_WIZARDS','SETTINGS_ADMIN_RBAC','AUTH_ONBOARDING','THEME_DENSITY',
    'LOCALIZATION_I18N','SYSTEM_STATES','SEARCH_COMMAND','NOTIFICATIONS_ACTIVITY','OFFLINE_SYNC','REALTIME_COLLAB',
    'PWA_UPDATE','MEDIA_FILES','RICH_CONTENT_EDITOR','PERFORMANCE_VIRTUALIZATION','DATA_VISUALIZATION','MAPS_LOCATION',
    'DRAG_DROP_REORDER','TOUCH_GESTURES','MOTION_TRANSITIONS','DESIGN_SYSTEM','ACCESSIBILITY','SCHEMA_UI',
    'VISUAL_BUILDER','VISUAL_TESTING','DOCS_GOVERNANCE','ASSETS_ICONS','PRINT_EXPORT',
  ]
  assert.equal(sectors.length,35)
  for(const sector of sectors) assert.match(runner,new RegExp(sector))
  assert.match(runner,/sectorCoverage/)
  assert.match(runner,/coveredUiSectors/)
  assert.match(runner,/uiSectorCount:RANDUI_SECTORS.length/)
  for(const provider of ['GITHUB','GITLAB','CODEBERG','GITEE','NPM','CRATES','HUGGINGFACE','OPENVSX']) assert.match(runner,new RegExp(provider))
})

test('RandRadar source policy is permanently wider than GitHub', () => {
  assert.equal(assertRepoRadarSourcePolicy(),true)
  const coverage=summarizeRepoRadarSourceCoverage()
  assert.ok(coverage.sourceCount>=REPO_RADAR_MIN_ECOSYSTEMS)
  assert.ok(coverage.automatedCount>=8)
  assert.ok(coverage.familyCount>=4)
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='FIGMA_COMMUNITY'))
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='MCP_SO'))
  assert.ok(REPO_RADAR_SOURCE_CATALOG.some((source)=>source.id==='PYPI'))
})

test('discovery metadata preserves sector for governed review', () => {
  const report=evaluateRepoCandidate({
    id:'ui-x',name:'UI X',repository:'https://github.com/example/ui-x',license:'MIT',maintained:true,
    category:'RANDUI',sector:'SYSTEM_STATES',source:'DISCOVERED',sourcePlatform:'GITHUB',capability:'ui-system-states',
    gates:{security:null,compatibility:null,benchmark:null,rollback:null},
    evidence:{security:.5,maintenance:.9,maturity:.6,tests:.5,compatibility:.9,performance:.5,rollback:.5,maintainability:.6},
  })
  assert.equal(report.sector,'SYSTEM_STATES')
  assert.equal(report.category,'RANDUI')
  assert.equal(report.decision,RepoRadarDecision.WATCH)
})

test('Repo Radar is live in ecosystem only with code UI and weekly evidence', () => {
  const radar=getRandEcosystemManifest().find((item)=>item.id==='reporadar')
  assert.equal(radar.status,'LIVE')
  assert.ok(radar.evidence.includes('src/randai/discovery/repo-radar.js'))
  assert.ok(radar.evidence.includes('src/randai/control/RepoRadarConsole.jsx'))
  assert.ok(radar.evidence.includes('.github/workflows/repo-radar.yml'))
})


test('Awesome Scalability stays a reference-only architecture source', () => {
  const source=REPO_RADAR_CATALOG.find((item)=>item.id==='awesome-scalability')
  assert.ok(source)
  assert.equal(source.usageMode,RepoRadarUsageMode.REFERENCE_ONLY)
  assert.equal(source.category,'ARCHITECTURE_REFERENCE')
  assert.equal(source.sector,'RELIABILITY_SCALABILITY')
  assert.match(source.note,/FONTE/)

  const report=buildRepoRadarSnapshot(REPO_RADAR_CATALOG).candidates.find((item)=>item.id==='awesome-scalability')
  assert.ok(report)
  assert.equal(report.usageMode,RepoRadarUsageMode.REFERENCE_ONLY)
  assert.equal(report.decision,RepoRadarDecision.WATCH)
  assert.equal(assertSafeAdoption(report),false)

  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
  const dependencies={...(pkg.dependencies||{}),...(pkg.devDependencies||{})}
  assert.equal(Object.keys(dependencies).some((name)=>/awesome-scalability/i.test(name)),false)

  const playbook=fs.readFileSync('docs/architecture/RAND_ARCHITECTURE_PLAYBOOK_V1.md','utf8')
  assert.match(playbook,/Adattare il pattern al problema reale/i)
  assert.match(playbook,/timeout.*retry/i)
  assert.match(playbook,/idempotency key.*dead-letter/i)
  assert.match(playbook,/Anti-pattern vietati/i)
})
