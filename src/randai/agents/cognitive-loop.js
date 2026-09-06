import { SkillStatus } from '../skills/contracts.js'
import { ToolRisk } from '../tools/contracts.js'
import { ToolsetResolver } from '../tools/toolsets.js'

const clone = (value) => value == null ? value : structuredClone(value)

export class RandMindCognitiveLoop {
  constructor({ runtime, skillRegistry, toolRegistry, learningEngine = null } = {}) {
    if (!runtime?.run) throw new TypeError('RandMindCognitiveLoop requires runtime')
    if (!skillRegistry?.discover || !skillRegistry?.inspect) throw new TypeError('RandMindCognitiveLoop requires skillRegistry')
    if (!toolRegistry?.list) throw new TypeError('RandMindCognitiveLoop requires toolRegistry')
    if (learningEngine != null && typeof learningEngine?.observe !== 'function') throw new TypeError('learningEngine must expose observe()')
    this.runtime = runtime
    this.skillRegistry = skillRegistry
    this.toolRegistry = toolRegistry
    this.toolsets = new ToolsetResolver({ toolRegistry })
    this.learningEngine = learningEngine
  }

  resolveSkills({ objective, skillIds = [] } = {}) {
    const explicit = [...new Set((skillIds || []).map(String))]
      .map((id) => this.skillRegistry.inspect(id))
      .filter((skill) => skill?.status === SkillStatus.APPROVED)
    if (explicit.length) return explicit
    return this.skillRegistry.discover({ text: objective, status: SkillStatus.APPROVED }).slice(0, 3)
  }

  async run({ objective, context = {}, skillIds = [], allowedToolIds = [], maxToolRisk = ToolRisk.LOW, metadata = {}, learningObservation = null } = {}) {
    const hotelId = String(context?.hotelId || '').trim()
    if (!hotelId) throw new TypeError('RandMind cognitive loop requires explicit hotelId')
    const skills = this.resolveSkills({ objective, skillIds })
    const tools = this.toolsets.resolve({ allowedToolIds, maxRisk: maxToolRisk })
    const runtimeContext = {
      ...clone(context),
      randMind: {
        ...(clone(context?.randMind) || {}),
        skills: skills.map((skill) => ({ id: skill.id, version: skill.version, risk: skill.risk, tags: [...skill.tags] })),
        tools: tools.map((tool) => ({ ...tool })),
      },
    }
    const result = await this.runtime.run({ objective, context: runtimeContext, metadata: { ...clone(metadata), randMindCognitiveLoop: true } })
    let learning = null
    if (this.learningEngine && learningObservation && result?.ok) {
      learning = await this.learningEngine.observe({
        ...clone(learningObservation),
        hotelId,
        verified: learningObservation.verified === true,
        tools: learningObservation.tools || tools.map((tool) => tool.id),
        metadata: { ...clone(learningObservation.metadata), hotelId, runId: result.runId },
      })
    }
    return { ...result, randMind: { skills: runtimeContext.randMind.skills, tools: runtimeContext.randMind.tools, learning: clone(learning) } }
  }
}
