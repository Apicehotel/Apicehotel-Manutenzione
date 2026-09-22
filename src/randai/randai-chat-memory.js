/** In-memory RandAI chat continuity across shell tab switches (same hotel/user). */
let memory = {
  key: null,
  messages: [],
  query: '',
  workspace: null,
  workspaceSummary: '',
}

const sessionKey = (session) => `${session?.hotelId || ''}:${session?.userId || ''}`

export function readRandAIChatMemory(session) {
  const key = sessionKey(session)
  if (!key || key === ':') {
    return { messages: [], query: '', workspace: null, workspaceSummary: '' }
  }
  if (memory.key !== key) {
    memory = { key, messages: [], query: '', workspace: null, workspaceSummary: '' }
  }
  return {
    messages: memory.messages,
    query: memory.query,
    workspace: memory.workspace,
    workspaceSummary: memory.workspaceSummary,
  }
}

export function writeRandAIChatMemory(session, patch = {}) {
  const key = sessionKey(session)
  if (!key || key === ':') return
  if (memory.key !== key) {
    memory = { key, messages: [], query: '', workspace: null, workspaceSummary: '' }
  }
  if ('messages' in patch) memory.messages = Array.isArray(patch.messages) ? patch.messages : []
  if ('query' in patch) memory.query = String(patch.query || '')
  if ('workspace' in patch) memory.workspace = patch.workspace || null
  if ('workspaceSummary' in patch) memory.workspaceSummary = String(patch.workspaceSummary || '')
}

export function clearRandAIChatMemory(session = null) {
  if (!session) {
    memory = { key: null, messages: [], query: '', workspace: null, workspaceSummary: '' }
    return
  }
  const key = sessionKey(session)
  if (memory.key === key) {
    memory = { key, messages: [], query: '', workspace: null, workspaceSummary: '' }
  }
}
