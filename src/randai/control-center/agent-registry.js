const AGENT_STALE_AFTER_MS = 5 * 60 * 1000

export const AgentRuntimeStatus = Object.freeze({
  RUNNING: 'RUNNING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
  IDLE: 'IDLE',
})

export const RAND_AGENTS = Object.freeze([
  { id: 'randai', name: 'RandAI', role: 'Coordinatore', autonomy: 'YELLOW' },
  { id: 'randradar', name: 'RandRadar', role: 'Ricerca e valutazione repository', autonomy: 'GREEN' },
  { id: 'randui', name: 'RandUI', role: 'Interfaccia e accessibilità', autonomy: 'YELLOW' },
  { id: 'randtest', name: 'RandTest', role: 'Test e quality gate', autonomy: 'GREEN' },
  { id: 'randsecure', name: 'RandSecure', role: 'Sicurezza e policy', autonomy: 'GREEN' },
  { id: 'randops', name: 'RandOps', role: 'Deploy, worker e operazioni', autonomy: 'YELLOW' },
  { id: 'randcore', name: 'RandCore', role: 'Governance e supervisione', autonomy: 'YELLOW' },
  { id: 'randmind', name: 'RandMind', role: 'Memoria e conoscenza condivisa', autonomy: 'GREEN' },
])

export function getAgentDefinition(agentId) {
  return RAND_AGENTS.find((agent) => agent.id === String(agentId || '').trim().toLowerCase()) || null
}

export function deriveAgentRuntimeStatus(runtime = {}, now = Date.now()) {
  const explicit = String(runtime.status || '').toUpperCase()
  if (explicit === AgentRuntimeStatus.ERROR) return AgentRuntimeStatus.ERROR
  if (explicit === AgentRuntimeStatus.WAITING_APPROVAL) return AgentRuntimeStatus.WAITING_APPROVAL

  const heartbeatAt = runtime.heartbeatAt || runtime.heartbeat_at || null
  const heartbeatMs = heartbeatAt ? new Date(heartbeatAt).getTime() : NaN
  if (!Number.isFinite(heartbeatMs) || now - heartbeatMs > AGENT_STALE_AFTER_MS) {
    return AgentRuntimeStatus.OFFLINE
  }

  if (runtime.taskId || runtime.task_id || explicit === AgentRuntimeStatus.RUNNING) {
    return AgentRuntimeStatus.RUNNING
  }
  return AgentRuntimeStatus.IDLE
}

export function normalizeAgentRuntime(runtime = {}, now = Date.now()) {
  const definition = getAgentDefinition(runtime.agentId || runtime.agent_id)
  if (!definition) throw new TypeError('Unknown Rand agent')

  return {
    ...definition,
    status: deriveAgentRuntimeStatus(runtime, now),
    heartbeatAt: runtime.heartbeatAt || runtime.heartbeat_at || null,
    taskId: runtime.taskId || runtime.task_id || null,
    activity: String(runtime.activity || '').trim() || null,
    detail: String(runtime.detail || '').trim() || null,
    hotelId: runtime.hotelId || runtime.hotel_id || null,
    updatedAt: runtime.updatedAt || runtime.updated_at || runtime.heartbeatAt || runtime.heartbeat_at || null,
  }
}

export function buildAgentRuntimeBoard(runtimeRows = [], now = Date.now()) {
  const byId = new Map(
    runtimeRows
      .filter(Boolean)
      .map((row) => [String(row.agentId || row.agent_id || '').toLowerCase(), row]),
  )

  return RAND_AGENTS.map((agent) => normalizeAgentRuntime({
    agentId: agent.id,
    ...(byId.get(agent.id) || {}),
  }, now))
}

export function agentStatusLabel(status) {
  switch (status) {
    case AgentRuntimeStatus.RUNNING: return 'In esecuzione'
    case AgentRuntimeStatus.WAITING_APPROVAL: return 'Attende approvazione'
    case AgentRuntimeStatus.ERROR: return 'Errore'
    case AgentRuntimeStatus.IDLE: return 'Disponibile'
    default: return 'Offline'
  }
}
