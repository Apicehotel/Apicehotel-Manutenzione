const clean = (value) => String(value ?? '').trim()
const nodeKey = (type, id) => `${type}:${id}`

export const RandGuideRelation = Object.freeze({
  LOCATED_IN:'LOCATED_IN',
  CONTAINS:'CONTAINS',
  HAS_EQUIPMENT:'HAS_EQUIPMENT',
  HAS_PROCEDURE:'HAS_PROCEDURE',
  USES_DOCUMENT:'USES_DOCUMENT',
  REFERENCES:'REFERENCES',
  RESOLVED_BY:'RESOLVED_BY',
})

export function buildRandGuideGraph({ hotelId, procedures = [], equipment = [], documents = [], links = [] } = {}) {
  if (!hotelId) throw new TypeError('RandGuide graph requires hotelId')
  const nodes = new Map()
  const edges = []
  const addNode = (type, id, data = {}) => {
    id = clean(id); if (!id) return null
    const key = nodeKey(type, id)
    if (!nodes.has(key)) nodes.set(key, Object.freeze({ key, type, id, hotelId, ...data }))
    return key
  }
  const addEdge = (from, relation, to, data = {}) => { if (from && to) edges.push(Object.freeze({ from, relation, to, ...data })) }

  for (const item of equipment.filter((x) => x.hotel_id === hotelId || x.hotelId === hotelId)) {
    const key = addNode('equipment', item.id, { label:item.name, category:item.category, location:item.location })
    const location = clean(item.location)
    if (location) addEdge(key, RandGuideRelation.LOCATED_IN, addNode('location', location.toLowerCase(), { label:location }))
  }
  for (const item of procedures.filter((x) => x.hotel_id === hotelId || x.hotelId === hotelId)) {
    const key = addNode('procedure', item.id, { label:item.title, status:item.status, version:item.version || 1 })
    const area = clean(item.area)
    if (area) addEdge(key, RandGuideRelation.REFERENCES, addNode('location', area.toLowerCase(), { label:area }))
    for (const equipmentId of item.equipment_ids || item.equipmentIds || []) addEdge(key, RandGuideRelation.REFERENCES, addNode('equipment', equipmentId))
  }
  for (const item of documents.filter((x) => x.hotel_id === hotelId || x.hotelId === hotelId)) {
    const key = addNode('document', item.id, { label:item.title, source:item.source_label || item.sourceLabel, status:item.status })
    if (item.procedure_id || item.procedureId) addEdge(addNode('procedure', item.procedure_id || item.procedureId), RandGuideRelation.USES_DOCUMENT, key)
    if (item.equipment_id || item.equipmentId) addEdge(addNode('equipment', item.equipment_id || item.equipmentId), RandGuideRelation.USES_DOCUMENT, key)
  }
  for (const link of links.filter((x) => (x.hotel_id || x.hotelId) === hotelId)) {
    const relation = Object.values(RandGuideRelation).includes(link.relation) ? link.relation : RandGuideRelation.REFERENCES
    addEdge(addNode(link.from_type || link.fromType, link.from_id || link.fromId), relation, addNode(link.to_type || link.toType, link.to_id || link.toId), { confidence:link.confidence ?? 100, source:link.source || null })
  }
  return Object.freeze({ hotelId, nodes:Object.freeze([...nodes.values()]), edges:Object.freeze(edges) })
}

export function findConnectedKnowledge(graph, { type, id, maxDepth = 2 } = {}) {
  const start = nodeKey(type, id)
  const seen = new Set([start]), queue = [{ key:start, depth:0 }], result = []
  while (queue.length) {
    const current = queue.shift()
    if (current.depth >= maxDepth) continue
    for (const edge of graph.edges) {
      const next = edge.from === current.key ? edge.to : edge.to === current.key ? edge.from : null
      if (!next || seen.has(next)) continue
      seen.add(next); result.push(edge); queue.push({ key:next, depth:current.depth+1 })
    }
  }
  return Object.freeze({ nodeKeys:Object.freeze([...seen]), edges:Object.freeze(result) })
}
