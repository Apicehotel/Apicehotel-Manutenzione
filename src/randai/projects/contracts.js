export const ProjectNodeType = Object.freeze({ FILE: 'FILE', MODULE: 'MODULE', DATABASE: 'DATABASE', TABLE: 'TABLE', FUNCTION: 'FUNCTION', SERVICE: 'SERVICE', WORKFLOW: 'WORKFLOW', TEST: 'TEST', EXTERNAL: 'EXTERNAL' })
export const ProjectEdgeType = Object.freeze({ IMPORTS: 'IMPORTS', CALLS: 'CALLS', READS: 'READS', WRITES: 'WRITES', DEPENDS_ON: 'DEPENDS_ON', TESTS: 'TESTS', DEPLOYS_TO: 'DEPLOYS_TO', PROTECTS: 'PROTECTS', EMITS: 'EMITS' })

export function validateProjectGraph(graph) {
  if (!graph?.projectId || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('projectId, nodes and edges are required')
  const ids = new Set()
  for (const node of graph.nodes) {
    if (!node?.id || !Object.values(ProjectNodeType).includes(node.type)) throw new TypeError('Project node requires valid id and type')
    if (ids.has(node.id)) throw new TypeError(`Duplicate project node id: ${node.id}`)
    ids.add(node.id)
  }
  for (const edge of graph.edges) {
    if (!edge?.from || !edge?.to || !Object.values(ProjectEdgeType).includes(edge.type)) throw new TypeError('Project edge requires from, to and valid type')
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new TypeError(`Project edge references unknown node: ${edge.from} -> ${edge.to}`)
  }
  return true
}
