const AGENT_STALE_AFTER_MS = 5 * 60 * 1000

export const AgentRuntimeStatus = Object.freeze({
  RUNNING: 'RUNNING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
  IDLE: 'IDLE',
})

export const RAND_ECOSYSTEM_COMPONENTS = Object.freeze([
  { id: 'randai', name: 'RandAI', kind: 'agent', runtime: true, role: 'Coordinatore', autonomy: 'YELLOW' },
  { id: 'randbrain', name: 'RandBrain', kind: 'agent', runtime: true, role: 'Ragionamento e pianificazione', autonomy: 'YELLOW' },
  { id: 'randcore', name: 'RandCore', kind: 'agent', runtime: true, role: 'Governance e supervisione', autonomy: 'YELLOW' },
  { id: 'randmind', name: 'RandMind', kind: 'agent', runtime: true, role: 'Memoria e conoscenza condivisa', autonomy: 'GREEN' },
  { id: 'randradar', name: 'RandRadar', kind: 'agent', runtime: true, role: 'Ricerca e valutazione repository', autonomy: 'GREEN' },
  { id: 'randresearch', name: 'RandResearch', kind: 'agent', runtime: true, role: 'Ricerca e verifica fonti', autonomy: 'GREEN' },
  { id: 'randsecure', name: 'RandSecure', kind: 'agent', runtime: true, role: 'Sicurezza e policy', autonomy: 'GREEN' },
  { id: 'randtest', name: 'RandTest', kind: 'agent', runtime: true, role: 'Test e quality gate', autonomy: 'GREEN' },
  { id: 'randops', name: 'RandOps', kind: 'agent', runtime: true, role: 'Deploy, worker e operazioni', autonomy: 'YELLOW' },
  { id: 'randui', name: 'RandUI', kind: 'service', runtime: true, role: 'Interfaccia e accessibilità', autonomy: 'YELLOW' },

  { id: 'randguide', name: 'RandGuide', kind: 'capability', runtime: false, role: 'Guide e procedure' },
  { id: 'randaudio', name: 'RandAudio', kind: 'capability', runtime: false, role: 'Voce e audio' },
  { id: 'randskills', name: 'RandSkills', kind: 'capability', runtime: false, role: 'Skill e routing capacità' },
  { id: 'randcontrol', name: 'RandControl', kind: 'interface', runtime: false, role: 'Controllo amministrativo' },
  { id: 'randcontext', name: 'RandContext', kind: 'service', runtime: false, role: 'Contesto operativo' },
  { id: 'randvisual', name: 'RandVisual', kind: 'capability', runtime: false, role: 'Analisi e supporto visuale' },
  { id: 'randarchitecture', name: 'RandArchitecture', kind: 'capability', runtime: false, role: 'Architettura e spazi' },
  { id: 'randchat', name: 'RandChat', kind: 'adapter', runtime: false, role: 'Canale chat' },
  { id: 'randgateway', name: 'RandGateway', kind: 'service', runtime: false, role: 'Ingresso canonico e routing' },
  { id: 'randmcp', name: 'RandMCP', kind: 'adapter', runtime: false, role: 'Adapter MCP' },
  { id: 'randeye', name: 'RandEye', kind: 'integration', runtime: false, role: 'Integrazione Eye; runtime dedicato non ancora rilevato' },
])

export const RAND_AGENTS = Object.freeze(
  RAND_ECOSYSTEM_COMPONENTS.filter((component) => component.runtime),
)

export const RAND_MODULES = Object.freeze(
  RAND_ECOSYSTEM_COMPONENTS.filter((component) => !component.runtime),
)

export function getRandComponent(componentId) {
  return RAND_ECOSYSTEM_COMPONENTS.find((component) => component.id === String(componentId || '').trim().toLowerCase()) || null
}

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
  if (!definition) throw new TypeError('Unknown Rand runtime unit')

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
