export const RandVisualDiagramType = Object.freeze({
  ARCHITECTURE: 'architecture',
  FLOW: 'flow',
  DEPENDENCY: 'dependency',
  DATABASE: 'database',
  PERMISSION_MATRIX: 'permission_matrix',
  WORKER: 'worker',
  DEPLOYMENT: 'deployment',
  FISHBONE: 'fishbone',
})

export const RandVisualDirection = Object.freeze({ TB: 'TB', LR: 'LR' })

const TYPES = new Set(Object.values(RandVisualDiagramType))
const DIRECTIONS = new Set(Object.values(RandVisualDirection))
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/

export function validateRandVisualSpec(input = {}) {
  if (!TYPES.has(input.type)) throw new TypeError(`Invalid RandVisual diagram type: ${input.type}`)
  if (!String(input.title || '').trim()) throw new TypeError('RandVisual title is required')
  if (!String(input.hotelId || '').trim()) throw new TypeError('RandVisual hotelId is required')
  if (input.direction && !DIRECTIONS.has(input.direction)) throw new TypeError(`Invalid RandVisual direction: ${input.direction}`)
  if (!Array.isArray(input.nodes)) throw new TypeError('RandVisual nodes must be an array')
  if (!Array.isArray(input.edges || [])) throw new TypeError('RandVisual edges must be an array')
  if (input.nodes.length > 120) throw new RangeError('RandVisual supports at most 120 nodes per diagram')
  if ((input.edges || []).length > 240) throw new RangeError('RandVisual supports at most 240 edges per diagram')

  const ids = new Set()
  for (const node of input.nodes) {
    if (!idPattern.test(String(node?.id || ''))) throw new TypeError(`Invalid RandVisual node id: ${node?.id}`)
    if (ids.has(node.id)) throw new TypeError(`Duplicate RandVisual node id: ${node.id}`)
    ids.add(node.id)
    if (!String(node.label || '').trim()) throw new TypeError(`RandVisual node ${node.id} requires label`)
    if (node.layer != null && (!Number.isInteger(Number(node.layer)) || Number(node.layer) < 0)) throw new TypeError(`Invalid layer for node ${node.id}`)
  }

  for (const edge of input.edges || []) {
    if (!ids.has(edge?.from) || !ids.has(edge?.to)) throw new TypeError(`RandVisual edge references unknown node: ${edge?.from} -> ${edge?.to}`)
    if (edge.from === edge.to) throw new TypeError(`RandVisual self-edge is not allowed: ${edge.from}`)
  }

  if (input.sourceIds != null && (!Array.isArray(input.sourceIds) || input.sourceIds.some((id) => !String(id || '').trim()))) {
    throw new TypeError('RandVisual sourceIds must be a non-empty string array when provided')
  }
  return true
}

export function normalizeRandVisualSpec(input = {}) {
  validateRandVisualSpec(input)
  return structuredClone({
    direction: RandVisualDirection.TB,
    edges: [],
    sourceIds: [],
    metadata: {},
    ...input,
    nodes: input.nodes.map((node) => ({ kind: 'default', layer: 0, emphasis: false, ...node })),
    edges: (input.edges || []).map((edge) => ({ kind: 'default', label: '', ...edge })),
    sourceIds: [...new Set(input.sourceIds || [])],
  })
}
