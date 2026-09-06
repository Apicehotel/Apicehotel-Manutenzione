import { ToolRisk } from './contracts.js'

const RISK_ORDER = Object.freeze([ToolRisk.LOW, ToolRisk.MEDIUM, ToolRisk.HIGH, ToolRisk.CRITICAL])

export class ToolsetResolver {
  constructor({ toolRegistry } = {}) {
    if (!toolRegistry?.list) throw new TypeError('ToolsetResolver requires toolRegistry')
    this.toolRegistry = toolRegistry
  }

  resolve({ allowedToolIds = [], maxRisk = ToolRisk.LOW } = {}) {
    const allowed = new Set((allowedToolIds || []).map(String))
    const maxIndex = RISK_ORDER.indexOf(maxRisk)
    if (maxIndex < 0) throw new TypeError(`Invalid maxRisk: ${maxRisk}`)
    return this.toolRegistry.list()
      .filter((tool) => allowed.has(tool.id))
      .filter((tool) => RISK_ORDER.indexOf(tool.risk) <= maxIndex)
      .map((tool) => Object.freeze({ id: tool.id, name: tool.name, description: tool.description, risk: tool.risk, permission: tool.permission }))
  }
}
