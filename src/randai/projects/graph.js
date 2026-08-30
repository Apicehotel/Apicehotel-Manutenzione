import { validateProjectGraph } from './contracts.js'

const clone = (value) => structuredClone(value)

export class ProjectGraph {
  constructor(graph = { projectId: 'randai', nodes: [], edges: [] }) {
    validateProjectGraph(graph)
    this.graph = clone(graph)
  }

  snapshot() { return clone(this.graph) }
  getNode(id) { return clone(this.graph.nodes.find((node) => node.id === id) || null) }

  upstream(id, { maxDepth = 4 } = {}) { return this.#walk(id, 'to', 'from', maxDepth) }
  downstream(id, { maxDepth = 4 } = {}) { return this.#walk(id, 'from', 'to', maxDepth) }

  impact(id, { maxDepth = 4 } = {}) {
    const direct = this.downstream(id, { maxDepth })
    const nodes = direct.map((item) => this.getNode(item.id)).filter(Boolean)
    return {
      source: this.getNode(id),
      affected: nodes,
      tests: nodes.filter((node) => node.type === 'TEST'),
      databases: nodes.filter((node) => ['DATABASE', 'TABLE'].includes(node.type)),
      services: nodes.filter((node) => ['SERVICE', 'EXTERNAL'].includes(node.type)),
      paths: direct,
    }
  }

  diff(other) {
    const next = other instanceof ProjectGraph ? other.snapshot() : clone(other)
    validateProjectGraph(next)
    const currentNodes = new Map(this.graph.nodes.map((node) => [node.id, node]))
    const nextNodes = new Map(next.nodes.map((node) => [node.id, node]))
    const edgeKey = (edge) => `${edge.from}|${edge.type}|${edge.to}`
    const currentEdges = new Set(this.graph.edges.map(edgeKey))
    const nextEdges = new Set(next.edges.map(edgeKey))
    return {
      addedNodes: [...nextNodes.keys()].filter((id) => !currentNodes.has(id)),
      removedNodes: [...currentNodes.keys()].filter((id) => !nextNodes.has(id)),
      changedNodes: [...nextNodes.keys()].filter((id) => currentNodes.has(id) && JSON.stringify(currentNodes.get(id)) !== JSON.stringify(nextNodes.get(id))),
      addedEdges: [...nextEdges].filter((id) => !currentEdges.has(id)),
      removedEdges: [...currentEdges].filter((id) => !nextEdges.has(id)),
    }
  }

  #walk(startId, matchKey, targetKey, maxDepth) {
    if (!this.getNode(startId)) return []
    const seen = new Set([startId])
    const queue = [{ id: startId, depth: 0, path: [startId] }]
    const output = []
    while (queue.length) {
      const current = queue.shift()
      if (current.depth >= maxDepth) continue
      for (const edge of this.graph.edges.filter((item) => item[matchKey] === current.id)) {
        const nextId = edge[targetKey]
        if (seen.has(nextId)) continue
        seen.add(nextId)
        const item = { id: nextId, depth: current.depth + 1, via: edge.type, path: [...current.path, nextId] }
        output.push(item)
        queue.push(item)
      }
    }
    return output
  }
}
