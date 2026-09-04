import { createHash } from 'node:crypto'
import { ToolPermission, ToolRisk, toolSuccess } from '../tools/contracts.js'
import { normalizeRandVisualSpec } from './contracts.js'
import { assertSafeRandVisualSvg, renderRandVisualSvg } from './renderer.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export class RandVisualScopeError extends Error {
  constructor(message = 'RandVisual hotel scope mismatch') {
    super(message)
    this.name = 'RandVisualScopeError'
    this.code = 'RAND_VISUAL_SCOPE_DENIED'
  }
}

export class RandVisualEngine {
  constructor({ tokens = {}, clock = nowIso } = {}) {
    if (typeof clock !== 'function') throw new TypeError('RandVisual clock must be a function')
    this.tokens = clone(tokens)
    this.clock = clock
  }

  render(input, { context = {} } = {}) {
    const spec = normalizeRandVisualSpec(input)
    if (context?.hotelId && String(context.hotelId) !== String(spec.hotelId)) {
      throw new RandVisualScopeError(`RandVisual cannot render ${spec.hotelId} inside ${context.hotelId} context`)
    }
    const rendered = renderRandVisualSvg(spec, { tokens: this.tokens })
    assertSafeRandVisualSvg(rendered.svg)
    const generatedAt = this.clock()
    const fingerprint = createHash('sha256').update(stableJson({ spec, width: rendered.width, height: rendered.height })).digest('hex')
    return {
      svg: rendered.svg,
      manifest: {
        engine: 'randvisual',
        version: 1,
        hotelId: spec.hotelId,
        diagramType: spec.type,
        title: spec.title,
        direction: spec.direction,
        nodeCount: spec.nodes.length,
        edgeCount: spec.edges.length,
        sourceIds: clone(spec.sourceIds),
        generatedAt,
        fingerprint,
        width: rendered.width,
        height: rendered.height,
        metadata: clone(spec.metadata || {}),
      },
    }
  }
}

export function createRandVisualTool(engine = new RandVisualEngine()) {
  if (!engine || typeof engine.render !== 'function') throw new TypeError('RandVisual tool requires an engine with render()')
  return {
    id: 'randvisual.render',
    name: 'RandVisual Renderer',
    description: 'Render authorized hotel-scoped architecture, flow, dependency, database, permission, worker, deployment and fishbone diagrams as safe SVG.',
    risk: ToolRisk.LOW,
    permission: ToolPermission.READ,
    idempotent: true,
    timeoutMs: 5000,
    retryPolicy: { maxAttempts: 1, delayMs: 0 },
    execute: async (input, context = {}) => toolSuccess(engine.render(input, { context }), { engine: 'randvisual', version: 1 }),
  }
}
