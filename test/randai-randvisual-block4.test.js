import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolPermission, ToolRisk } from '../src/randai/tools/contracts.js'
import {
  RandVisualDiagramType,
  RandVisualDirection,
  RandVisualEngine,
  RandVisualScopeError,
  assertSafeRandVisualSvg,
  createRandVisualTool,
  layoutRandVisual,
} from '../src/randai/visual/index.js'

const baseSpec = (overrides = {}) => ({
  type: RandVisualDiagramType.ARCHITECTURE,
  title: 'Rand architecture',
  hotelId: 'hotelgio',
  direction: RandVisualDirection.TB,
  sourceIds: ['randcore:health', 'randai:runtime'],
  nodes: [
    { id: 'randapp', label: 'RandApp', layer: 0 },
    { id: 'randai', label: 'RandAI', layer: 1, emphasis: true },
    { id: 'randcore', label: 'RandCore', layer: 2 },
  ],
  edges: [
    { from: 'randapp', to: 'randai', label: 'context' },
    { from: 'randai', to: 'randcore', label: 'governance' },
  ],
  ...overrides,
})

test('RandVisual renders deterministic safe SVG with provenance manifest', () => {
  const engine = new RandVisualEngine({ clock: () => '2026-09-04T16:00:00.000Z' })
  const first = engine.render(baseSpec(), { context: { hotelId: 'hotelgio' } })
  const second = engine.render(baseSpec(), { context: { hotelId: 'hotelgio' } })
  assert.match(first.svg, /^<svg /)
  assert.match(first.svg, /data-randvisual="1"/)
  assert.match(first.svg, /Rand architecture/)
  assert.equal(first.manifest.hotelId, 'hotelgio')
  assert.equal(first.manifest.diagramType, 'architecture')
  assert.deepEqual(first.manifest.sourceIds, ['randcore:health', 'randai:runtime'])
  assert.equal(first.manifest.generatedAt, '2026-09-04T16:00:00.000Z')
  assert.equal(first.manifest.fingerprint, second.manifest.fingerprint)
  assertSafeRandVisualSvg(first.svg)
})

test('RandVisual escapes untrusted labels instead of emitting executable markup', () => {
  const engine = new RandVisualEngine()
  const result = engine.render(baseSpec({
    title: '<script>alert(1)</script>',
    nodes: [{ id: 'n1', label: '<img src=x onerror=alert(1)>', layer: 0 }],
    edges: [],
  }), { context: { hotelId: 'hotelgio' } })
  assert.doesNotMatch(result.svg, /<script\b/i)
  assert.doesNotMatch(result.svg, /<img\b/i)
  assert.doesNotMatch(result.svg, /onerror\s*=/i)
  assert.match(result.svg, /&lt;script&gt;/)
  assert.match(result.svg, /&lt;img/)
})

test('RandVisual rejects cross-hotel rendering', () => {
  const engine = new RandVisualEngine()
  assert.throws(
    () => engine.render(baseSpec(), { context: { hotelId: 'chocohotel' } }),
    (error) => error instanceof RandVisualScopeError && error.code === 'RAND_VISUAL_SCOPE_DENIED',
  )
})

test('RandVisual validates graph integrity and node limits', () => {
  const engine = new RandVisualEngine()
  assert.throws(() => engine.render(baseSpec({ edges: [{ from: 'randapp', to: 'missing' }] })), /unknown node/i)
  assert.throws(() => engine.render(baseSpec({ nodes: [{ id: 'dup', label: 'A' }, { id: 'dup', label: 'B' }], edges: [] })), /duplicate/i)
  const nodes = Array.from({ length: 121 }, (_, index) => ({ id: `n${index}`, label: `Node ${index}` }))
  assert.throws(() => engine.render(baseSpec({ nodes, edges: [] })), /at most 120/i)
})

test('layout is deterministic and supports TB/LR without manual coordinates', () => {
  const tb = layoutRandVisual(baseSpec())
  const tb2 = layoutRandVisual(baseSpec())
  const lr = layoutRandVisual(baseSpec({ direction: RandVisualDirection.LR }))
  assert.deepEqual([...tb.positions.entries()], [...tb2.positions.entries()])
  assert.notDeepEqual([...tb.positions.entries()], [...lr.positions.entries()])
  assert.ok(tb.width >= 420 && tb.height >= 300)
  assert.ok(lr.width >= 420 && lr.height >= 300)
})

test('RandVisual tool is read-only, low-risk and idempotent for Permission Gateway compatibility', async () => {
  const tool = createRandVisualTool(new RandVisualEngine({ clock: () => '2026-09-04T16:00:00.000Z' }))
  assert.equal(tool.id, 'randvisual.render')
  assert.equal(tool.permission, ToolPermission.READ)
  assert.equal(tool.risk, ToolRisk.LOW)
  assert.equal(tool.idempotent, true)
  const result = await tool.execute(baseSpec(), { hotelId: 'hotelgio' })
  assert.equal(result.status, 'SUCCESS')
  assert.equal(result.data.manifest.engine, 'randvisual')
})

test('all planned Block 4 diagram grammars are accepted by one canonical engine', () => {
  const engine = new RandVisualEngine()
  for (const type of Object.values(RandVisualDiagramType)) {
    const result = engine.render(baseSpec({ type, title: `Diagram ${type}` }), { context: { hotelId: 'hotelgio' } })
    assert.equal(result.manifest.diagramType, type)
    assert.match(result.svg, new RegExp(`data-diagram-type="${type}"`))
  }
})

test('standalone SVG safety gate rejects remote/executable surfaces', () => {
  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>html</div></foreignObject></svg>',
    '<svg><image href="https://evil.example/x.png"/></svg>',
    '<svg><g onclick="x()"/></svg>',
  ]) assert.throws(() => assertSafeRandVisualSvg(unsafe), /unsafe/i)
})
