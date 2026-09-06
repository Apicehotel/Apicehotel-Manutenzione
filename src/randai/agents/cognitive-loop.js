import { ToolRisk } from '../tools/contracts.js'
import { ToolsetResolver } from '../tools/toolsets.js'
import { RandSkillRouter, matchesToolPattern } from '../skills/router.js'

const clone = (value) => value == null ? value : structuredClone(value)

export class RandMindCognitiveLoop {
  constructor({ runtime, skillRegistry, toolRegistry, learningEngine = null, skillRouter = null } = {}) {
    if (!runtime?.run) throw new TypeError('RandMindCognitiveLoop requires runtime')
    if (!skillRegistry?.discover || !skillRegistry?.inspect) throw new TypeError('RandMindCognitiveLoop requires skillRegistry')
    if (!toolRegistry?.list) throw new TypeError('RandMindCognitiveLoop requires toolRegistry')
    if (learningEngine != null && typeof learningEngine?.observe !== 'function') throw new TypeError('learningEngine must expose observe()')
    this.runtime = runtime
    this.skillRegistry = skillRegistry
    this.toolRegistry = toolRegistry
    this.toolsets = new ToolsetResolver({ toolRegistry })
    this.skillRouter = skillRouter || new RandSkillRouter({ skillRegistry })
    this.learningEngine = learningEngine
  }

  routeSkills({ objective, skillIds = [] } = {}) {
    return this.skillRouter.route({ objective, explicitSkillIds: skillIds })
  }

  async run({ objective, context = {}, skillIds = [], allowedToolIds = [], maxToolRisk = ToolRisk.LOW, metadata = {}, learningObservation = null } = {}) {
    const hotelId = String(context?.hotelId || '').trim()
    if (!hotelId) throw new TypeError('RandMind cognitive loop requires explicit hotelId')

    const routing = this.routeSkills({ objective, skillIds })
    const skills = routing.skillIds.map((id) => this.skillRegistry.inspect(id)).filter(Boolean)
    const patterns = routing.requiredToolPatterns || []
    const callerAllowed = new Set((allowedToolIds || []).map(String))
    const patternMatches = [...callerAllowed].filter((toolId) => patterns.some((pattern) => matchesToolPattern(toolId, pattern)))
    const permissionFallback = this.toolRegistry.list()
      .filter((tool) => callerAllowed.has(tool.id))
      .filter((tool) => routing.requiredPermissions.includes(tool.permission))
      .map((tool) => tool.id)
    const boundedAllowedToolIds = patternMatches.length ? patternMatches : permissionFallback
    const tools = this.toolsets.resolve({ allowedToolIds: boundedAllowedToolIds, maxRisk: maxToolRisk })

    const runtimeContext = {
      ...clone(context),
      randMind: {
        ...(clone(context?.randMind) || {}),
        routing: clone(routing),
        skills: skills.map((skill) => ({ id: skill.id, version: skill.version, risk: skill.risk, tags: [...skill.tags], permissions: [...skill.permissions], requiredTools: [...skill.requiredTools], successCriteria: [...skill.successCriteria] })),
        tools: tools.map((tool) => ({ ...tool })),
      },
    }
    const result = await this.runtime.run({ objective, context: runtimeContext, metadata: { ...clone(metadata), randMindCognitiveLoop: true, skillRoutingMode: routing.mode } })
    let learning = null
    if (this.learningEngine && learningObservation && result?.ok) {
      learning = await this.learningEngine.observe({
        ...clone(learningObservation),
        hotelId,
        verified: learningObservation.verified === true,
        tools: learningObservation.tools || tools.map((tool) => tool.id),
        metadata: { ...clone(learningObservation.metadata), hotelId, runId: result.runId, skillIds: routing.skillIds },
      })
    }
    return { ...result, randMind: { routing: clone(routing), skills: runtimeContext.randMind.skills, tools: runtimeContext.randMind.tools, learning: clone(learning) } }
  }
}
