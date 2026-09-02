const text = (v) => String(v ?? '').trim()
const key = (item) => `${text(item.kind)}:${text(item.id)}`

export function buildHybridKnowledgeContext({ hotelId, memories = [], nodes = [], edges = [], minTrust = 0.7 } = {}) {
  const scope = text(hotelId)
  if (!scope) throw new TypeError('hotelId is required')
  const threshold = Number(minTrust)
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new TypeError('minTrust must be finite 0..1')
  const scopedMemories = (memories || []).filter((m) => text(m.hotelId) === scope && Number(m.trustScore ?? 0) >= threshold)
  const scopedNodes = (nodes || []).filter((n) => !n.hotelId || text(n.hotelId) === scope)
  const nodeIds = new Set(scopedNodes.map((n) => text(n.id)).filter(Boolean))
  const scopedEdges = (edges || []).filter((e) => (!e.hotelId || text(e.hotelId) === scope) && nodeIds.has(text(e.from)) && nodeIds.has(text(e.to)))
  const seen = new Set()
  const context = []
  for (const memory of scopedMemories) {
    const item = Object.freeze({ kind: 'memory', id: text(memory.id), content: memory.content, trustScore: Number(memory.trustScore), source: memory.source })
    const k = key(item)
    if (!seen.has(k)) { seen.add(k); context.push(item) }
  }
  for (const node of scopedNodes) {
    const item = Object.freeze({ kind: 'graph', id: text(node.id), type: node.type, label: node.label, data: node.data ?? null })
    const k = key(item)
    if (!seen.has(k)) { seen.add(k); context.push(item) }
  }
  return Object.freeze({ hotelId: scope, context: Object.freeze(context), edges: Object.freeze(scopedEdges.map((e) => Object.freeze({ ...e }))) })
}
