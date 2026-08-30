export const MemoryType = Object.freeze({
  WORKING: 'working', CONVERSATIONAL: 'conversational', EPISODIC: 'episodic',
  SEMANTIC: 'semantic', PROCEDURAL: 'procedural', PROJECT: 'project',
})

export const MemoryTrust = Object.freeze({
  DRAFT: 'draft', SUGGESTED: 'suggested', VERIFIED: 'verified', APPROVED: 'approved', OUTDATED: 'outdated',
})

export const MemoryScope = Object.freeze({ GLOBAL: 'global', PROJECT: 'project', HOTEL: 'hotel', TASK: 'task' })

export function validateMemory(input = {}) {
  if (!Object.values(MemoryType).includes(input.type)) throw new TypeError(`Invalid memory type: ${input.type}`)
  if (!Object.values(MemoryTrust).includes(input.trust)) throw new TypeError(`Invalid memory trust: ${input.trust}`)
  if (!Object.values(MemoryScope).includes(input.scope)) throw new TypeError(`Invalid memory scope: ${input.scope}`)
  if (!String(input.content || '').trim()) throw new TypeError('Memory content is required')
  if (!input.source?.kind || !input.source?.id) throw new TypeError('Memory source kind and id are required')
  if (input.scope === MemoryScope.HOTEL && !input.hotelId) throw new TypeError('hotelId is required for hotel-scoped memory')
  if (input.scope === MemoryScope.PROJECT && !input.projectId) throw new TypeError('projectId is required for project-scoped memory')
  if (input.scope === MemoryScope.TASK && !input.taskId) throw new TypeError('taskId is required for task-scoped memory')
  return true
}
