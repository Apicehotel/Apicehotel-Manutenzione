const estimateTokens = (text) => Math.ceil(String(text || '').length / 4)

export class ContextEngine {
  constructor({ memoryEngine, defaultBudget = 4000 } = {}) {
    if (!memoryEngine) throw new TypeError('memoryEngine is required')
    this.memoryEngine = memoryEngine
    this.defaultBudget = defaultBudget
  }

  async build({ query, hotelId, projectId, taskId, budget = this.defaultBudget, trust = ['approved','verified','suggested'] } = {}) {
    if (!String(query || '').trim()) throw new TypeError('query is required')
    const memories = await this.memoryEngine.recall(query, { hotelId, projectId, taskId, trust })
    const sections = []
    let used = 0
    const seen = new Set()
    for (const memory of memories) {
      const fingerprint = `${memory.type}:${memory.summary || memory.content}`.toLowerCase()
      if (seen.has(fingerprint)) continue
      seen.add(fingerprint)
      const body = memory.summary || memory.content
      const cost = estimateTokens(body) + 16
      if (used + cost > budget) continue
      sections.push({ id: memory.id, type: memory.type, trust: memory.trust, content: body, score: memory.score, source: memory.source, tokens: cost })
      used += cost
    }
    return {
      query,
      scope: { hotelId: hotelId || null, projectId: projectId || null, taskId: taskId || null },
      budget,
      usedTokens: used,
      remainingTokens: Math.max(0, budget - used),
      sections,
      provenance: sections.map(s => ({ memoryId: s.id, source: s.source, trust: s.trust })),
    }
  }
}
