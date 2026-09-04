import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RandCoreVisualEvidenceError,
  RandCoreVisualIntelligence,
  RandCoreVisualView,
  buildDatabaseVisualSpec,
  buildDeploymentVisualSpec,
  buildHealthVisualSpec,
  buildPermissionVisualSpec,
  buildRepoImpactVisualSpec,
  buildWorkerVisualSpec,
  createRandCoreVisualIntelligenceTool,
} from '../src/randai/visual/index.js'
import { ToolPermission, ToolRisk, ToolStatus } from '../src/randai/tools/contracts.js'

const hotelId = 'hotelgio'
const checkedAt = '2026-09-04T16:00:00.000Z'

function healthSnapshot() {
  const domains = Object.fromEntries(['database','security','workers','deploy','backup_restore','integrations','dependencies'].map((domain) => [domain, {
    status: 'HEALTHY', score: 100, confidence: 100, state: 'VERIFIED', checkedAt, source: `source-${domain}`, evidence: { id: `ev-${domain}` },
  }]))
  return { version: 2, generated_at: checkedAt, evaluated_at: checkedAt, domains }
}

test('health map is generated from canonical seven-domain evidence with provenance', () => {
  const spec = buildHealthVisualSpec({ hotelId, snapshot: healthSnapshot() })
  assert.equal(spec.type, 'architecture')
  assert.equal(spec.hotelId, hotelId)
  assert.equal(spec.nodes.length, 8)
  assert.equal(spec.edges.length, 7)
  assert.equal(spec.metadata.verifiedDomains, 7)
  assert.ok(spec.sourceIds.some((id) => id.includes('health:database:source-database')))
  assert.ok(spec.sourceIds.some((id) => id === 'evidence:ev-database'))
})

test('health map fails closed when there is no evidence provenance', () => {
  assert.throws(() => buildHealthVisualSpec({
    hotelId,
    snapshot: { version: 2, generated_at: checkedAt, evaluated_at: checkedAt, domains: {} },
  }), (error) => error instanceof RandCoreVisualEvidenceError && error.code === 'RANDCORE_VISUAL_PROVENANCE_REQUIRED')
})

test('worker map requires provenance and keeps scheduler as canonical root', () => {
  const spec = buildWorkerVisualSpec({
    hotelId,
    snapshot: {
      sourceIds: ['worker-registry:gio'],
      workers: [
        { id: 'weather', name: 'Meteo', status: 'HEALTHY', schedule: '2h', trigger: 'cron' },
        { id: 'urgent', name: 'Urgenze', status: 'HEALTHY', schedule: 'event-driven', trigger: 'queue' },
      ],
    },
  })
  assert.equal(spec.type, 'worker')
  assert.equal(spec.nodes[0].id, 'scheduler')
  assert.equal(spec.edges.length, 2)
  assert.deepEqual(spec.sourceIds, ['worker-registry:gio'])
})

test('permission matrix visual refuses cross-hotel cases and shows verified mismatches', () => {
  assert.throws(() => buildPermissionVisualSpec({
    hotelId,
    sourceIds: ['authorization-matrix:v1'],
    snapshot: { cases: [{ id:'x', hotelId:'chocohotel', actorRole:'admin', module:'issues', action:'read', expected:'ALLOW' }] },
  }), (error) => error.code === 'RANDCORE_VISUAL_SCOPE_DENIED')

  const spec = buildPermissionVisualSpec({
    hotelId,
    sourceIds: ['authorization-matrix:v1'],
    snapshot: {
      cases: [{ id:'a', hotelId, actorRole:'admin', module:'issues', action:'delete', expected:'DENY' }],
      results: [{ id:'a', expected:'DENY', actual:'ALLOW', ok:false }],
    },
  })
  assert.equal(spec.metadata.failures, 1)
  assert.match(spec.edges[0].label, /DENY \/ ALLOW/)
})

test('deployment map validates dependency graph and carries commit provenance', () => {
  const spec = buildDeploymentVisualSpec({
    hotelId,
    sourceIds: ['vercel:deployment:123'],
    snapshot: {
      commitSha: 'abcdef0123456789',
      services: [
        { id:'github', name:'GitHub', status:'HEALTHY' },
        { id:'vercel', name:'Vercel', environment:'production', status:'HEALTHY', commitSha:'abcdef0123456789', dependsOn:['github'] },
      ],
    },
  })
  assert.equal(spec.type, 'deployment')
  assert.equal(spec.edges[0].from, 'service:github')
  assert.equal(spec.metadata.commitSha, 'abcdef0123456789')
  assert.throws(() => buildDeploymentVisualSpec({ hotelId, sourceIds:['x'], snapshot:{ services:[{id:'a',dependsOn:['missing']}] } }), /unknown service/)
})

test('database map uses schema snapshot only and validates foreign-key targets', () => {
  const spec = buildDatabaseVisualSpec({
    hotelId,
    sourceIds: ['postgres:introspection:public'],
    snapshot: {
      schema: 'public',
      tables: [
        { name:'hotels', columns:['id','name'] },
        { name:'issues', columns:['id','hotel_id'], foreignKeys:[{ column:'hotel_id', referencesTable:'hotels' }] },
      ],
    },
  })
  assert.equal(spec.type, 'database')
  assert.equal(spec.edges[0].to, 'table:hotels')
  assert.equal(spec.metadata.schema, 'public')
})

test('repo radar impact map separates candidate, affected modules and dependencies', () => {
  const spec = buildRepoImpactVisualSpec({
    hotelId,
    sourceIds: ['repo-radar:scan:77'],
    snapshot: {
      candidate: { repository:'cathrynlavery/diagram-design' },
      decision: 'ADD',
      affectedModules: [{ id:'randvisual', name:'RandVisual', impact:'improve', change:'patterns' }],
      dependencies: [{ id:'none-runtime', name:'No runtime dependency', moduleId:'randvisual', risk:'low' }],
    },
  })
  assert.equal(spec.type, 'dependency')
  assert.equal(spec.metadata.decision, 'ADD')
  assert.equal(spec.nodes.length, 3)
  assert.equal(spec.edges.length, 2)
})

test('visual intelligence renders safe SVG without querying a data source itself', () => {
  const intelligence = new RandCoreVisualIntelligence()
  const result = intelligence.render(RandCoreVisualView.HEALTH, { hotelId, snapshot: healthSnapshot() }, { context: { hotelId } })
  assert.equal(result.manifest.hotelId, hotelId)
  assert.equal(result.spec.metadata.view, 'health')
  assert.match(result.svg, /<svg/)
  assert.doesNotMatch(result.svg, /<script/i)
})

test('RandCore visual intelligence tool is read-only, low-risk and governed by ToolRegistry boundary', async () => {
  const tool = createRandCoreVisualIntelligenceTool()
  assert.equal(tool.permission, ToolPermission.READ)
  assert.equal(tool.risk, ToolRisk.LOW)
  assert.equal(tool.idempotent, true)
  const result = await tool.execute({ view: RandCoreVisualView.HEALTH, input: { hotelId, snapshot: healthSnapshot() } }, { hotelId })
  assert.equal(result.status, ToolStatus.SUCCESS)
  assert.equal(result.data.manifest.hotelId, hotelId)
})
