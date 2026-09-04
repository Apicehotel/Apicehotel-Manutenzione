import { MemoryScope, MemoryTrust, MemoryType } from './contracts.js'
import { RetentionClass, memoryQuality } from './randmind.js'

const clone = (value) => value == null ? value : structuredClone(value)
const text = (value) => String(value ?? '').trim()
const nowIso = () => new Date().toISOString()

export const RandContinuityVersion = 1

export class RandContinuityError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'RandContinuityError'
    this.code = code
    this.details = clone(details)
  }
}

function fail(code, message, details) {
  throw new RandContinuityError(code, message, details)
}

function actorIdOf(context = {}, metadata = {}) {
  return text(context?.actor?.id || context?.user?.id || context?.userId || metadata?.actorId)
}

function taskIdOf(context = {}, metadata = {}) {
  return text(context?.taskId || context?.randAgent?.taskId || metadata?.taskId)
}

function safeMemory(memory) {
  return Object.freeze({
    id: memory.id,
    type: memory.type,
    trust: memory.trust,
    summary: memory.summary || null,
    content: memory.content,
    confidence: Number(memory.confidence),
    importance: Number(memory.importance),
    validFrom: memory.validFrom || memory.createdAt || null,
    lastVerifiedAt: memory.lastVerifiedAt || null,
    source: clone(memory.source),
    metadata: Object.freeze({
      continuityId: memory.metadata?.continuityId || null,
      runId: memory.metadata?.runId || null,
      channel: memory.metadata?.channel || null,
      taskId: memory.metadata?.taskId || null,
    }),
  })
}

export function resolveContinuityIdentity({ context = {}, metadata = {}, channel = 'internal', runId = null } = {}) {
  const hotelId = text(context?.hotelId)
  if (!hotelId) fail('RAND_CONTINUITY_HOTEL_REQUIRED', 'Rand continuity requires hotelId')
  const actorId = actorIdOf(context, metadata)
  const taskId = taskIdOf(context, metadata)
  const supplied = text(context?.continuityId || context?.randContinuity?.continuityId || metadata?.continuityId)
  const continuityId = supplied || `CONT-${crypto.randomUUID()}`
  return Object.freeze({
    version: RandContinuityVersion,
    continuityId,
    hotelId,
    actorId: actorId || null,
    taskId: taskId || null,
    channel: text(channel) || 'internal',
    runId: text(runId) || null,
  })
}

export class RandMindContinuity {
  constructor({ randMind, maxMemories = 8 } = {}) {
    if (!randMind?.remember || typeof randMind.remember !== 'function' || !randMind?.timeline || typeof randMind.timeline !== 'function') {
      throw new TypeError('RandMindContinuity requires RandMind')
    }
    const limit = Number(maxMemories)
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('maxMemories must be an integer between 1 and 50')
    this.randMind = randMind
    this.maxMemories = limit
  }

  async open({ objective, context = {}, channel = 'internal', metadata = {}, runId = null } = {}) {
    const identity = resolveContinuityIdentity({ context, metadata, channel, runId })
    const timeline = await this.randMind.timeline({ scope: MemoryScope.HOTEL, hotelId: identity.hotelId })
    const related = timeline
      .filter((memory) => text(memory?.metadata?.continuityId) === identity.continuityId)
      .filter((memory) => memoryQuality(memory).usable)

    for (const memory of related) {
      const memoryActorId = text(memory?.metadata?.actorId)
      if (identity.actorId && memoryActorId && memoryActorId !== identity.actorId) {
        fail('RAND_CONTINUITY_ACTOR_MISMATCH', 'Continuity belongs to a different actor', {
          continuityId: identity.continuityId,
          hotelId: identity.hotelId,
        })
      }
      const memoryTaskId = text(memory?.metadata?.taskId)
      if (identity.taskId && memoryTaskId && memoryTaskId !== identity.taskId) {
        fail('RAND_CONTINUITY_TASK_MISMATCH', 'Continuity belongs to a different task', {
          continuityId: identity.continuityId,
          hotelId: identity.hotelId,
        })
      }
    }

    const memories = related
      .slice()
      .sort((a, b) => Date.parse(b.validFrom || b.createdAt || 0) - Date.parse(a.validFrom || a.createdAt || 0))
      .slice(0, this.maxMemories)
      .map(safeMemory)

    const snapshot = Object.freeze({
      ...identity,
      openedAt: nowIso(),
      objective: text(objective),
      memoryIds: Object.freeze(memories.map((memory) => memory.id)),
      memories: Object.freeze(memories),
    })

    return Object.freeze({
      identity,
      context: Object.freeze({
        continuityId: identity.continuityId,
        randContinuity: snapshot,
      }),
      state: Object.freeze({
        continuityId: identity.continuityId,
        hotelId: identity.hotelId,
        actorId: identity.actorId,
        taskId: identity.taskId,
        openedMemoryIds: snapshot.memoryIds,
      }),
    })
  }

  async commit({ objective, context = {}, channel = 'internal', metadata = {}, runId = null, execution = null, inspection = null } = {}) {
    if (!execution?.ok || inspection?.ok === false) return Object.freeze({ saved: false, reason: 'UNVERIFIED_OUTCOME' })
    const identity = resolveContinuityIdentity({ context, metadata, channel, runId })
    const outcomeSummary = text(inspection?.summary || execution?.summary || execution?.result?.summary)
    const content = outcomeSummary ? `Completed: ${text(objective)} — ${outcomeSummary}` : `Completed: ${text(objective)}`
    const remembered = await this.randMind.remember({
      type: MemoryType.EPISODIC,
      scope: MemoryScope.HOTEL,
      hotelId: identity.hotelId,
      trust: MemoryTrust.VERIFIED,
      content,
      summary: outcomeSummary || text(objective),
      source: { kind: 'rand-agent-run', id: text(runId) || identity.continuityId },
      importance: 0.7,
      confidence: 1,
      retentionClass: RetentionClass.OPERATIONAL,
      lastVerifiedAt: nowIso(),
      tags: ['rand-continuity', 'verified-outcome'],
      metadata: {
        continuityId: identity.continuityId,
        runId: text(runId) || null,
        channel: identity.channel,
        actorId: identity.actorId,
        taskId: identity.taskId,
        outcome: 'verified',
      },
    })
    return Object.freeze({
      saved: true,
      deduplicated: Boolean(remembered?.deduplicated),
      memoryId: remembered?.memory?.id || null,
      continuityId: identity.continuityId,
    })
  }
}
