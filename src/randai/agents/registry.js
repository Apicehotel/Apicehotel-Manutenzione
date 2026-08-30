import { validateAgent } from './contracts.js'

const clone = (value) => structuredClone(value)

export class AgentRegistry {
  #agents = new Map()

  constructor({ agents = [] } = {}) { agents.forEach((agent) => this.register(agent)) }

  register(input) {
    validateAgent(input)
    const agent = { tools: [], modelRequest: {}, enabled: true, metadata: {}, ...clone(input) }
    this.#agents.set(agent.id, agent)
    return clone(agent)
  }

  get(id) { const agent = this.#agents.get(id); return agent ? clone(agent) : null }
  list({ role, enabled = true } = {}) {
    return [...this.#agents.values()]
      .filter((agent) => !role || agent.role === role)
      .filter((agent) => enabled == null || Boolean(agent.enabled) === Boolean(enabled))
      .map(clone)
  }
  findByRole(role) { return this.list({ role })[0] || null }
}
