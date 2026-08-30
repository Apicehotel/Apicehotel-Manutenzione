import { ProjectGraph, ProjectGraphStore } from './index.js'
import { validateProjectGraph } from './contracts.js'

const clone = (value) => structuredClone(value)

export class ProjectIntelligenceEngine {
  constructor({ store = new ProjectGraphStore(), scanners = [] } = {}) {
    this.store = store
    this.scanners = new Map()
    for (const scanner of scanners) this.registerScanner(scanner)
  }

  registerScanner(scanner) {
    if (!scanner?.id || typeof scanner.scan !== 'function') throw new TypeError('Project scanner requires id and scan()')
    if (this.scanners.has(scanner.id)) throw new Error(`Project scanner already registered: ${scanner.id}`)
    this.scanners.set(scanner.id, scanner)
    return scanner.id
  }

  listScanners() { return [...this.scanners.keys()].sort() }

  async scan({ projectId = 'randai', context = {} } = {}) {
    const previous = await this.store.load(projectId)
    const nodes = new Map()
    const edges = new Map()
    const sources = []

    for (const scanner of this.scanners.values()) {
      const snapshot = await scanner.scan({ projectId, context: clone(context) })
      const fragment = { projectId, nodes: snapshot?.nodes || [], edges: snapshot?.edges || [] }
      validateProjectGraph(fragment)
      sources.push({ scannerId: scanner.id, scannedAt: new Date().toISOString(), metadata: clone(snapshot?.metadata || {}) })
      for (const node of fragment.nodes) {
        const current = nodes.get(node.id)
        nodes.set(node.id, current ? { ...current, ...clone(node), sources: [...new Set([...(current.sources || []), scanner.id])] } : { ...clone(node), sources: [scanner.id] })
      }
      for (const edge of fragment.edges) {
        const key = `${edge.from}|${edge.type}|${edge.to}`
        const current = edges.get(key)
        edges.set(key, current ? { ...current, ...clone(edge), sources: [...new Set([...(current.sources || []), scanner.id])] } : { ...clone(edge), sources: [scanner.id] })
      }
    }

    const graph = { projectId, nodes: [...nodes.values()], edges: [...edges.values()], sources, updatedAt: new Date().toISOString() }
    validateProjectGraph(graph)
    const projectGraph = new ProjectGraph(graph)
    const diff = previous ? new ProjectGraph(previous).diff(graph) : { addedNodes: graph.nodes.map((node) => node.id), removedNodes: [], changedNodes: [], addedEdges: graph.edges.map((edge) => `${edge.from}|${edge.type}|${edge.to}`), removedEdges: [] }
    await this.store.save(graph)
    return { graph: projectGraph.snapshot(), diff }
  }

  async impact(projectId, nodeId, options = {}) {
    const graph = await this.store.load(projectId)
    if (!graph) throw new Error(`Project graph not found: ${projectId}`)
    return new ProjectGraph(graph).impact(nodeId, options)
  }
}
