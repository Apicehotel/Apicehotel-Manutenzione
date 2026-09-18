const AGENTS = new Set(['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui'])

export async function writeAgentHeartbeat({ supabase, agentId, status = 'IDLE', taskId = null, activity = null, detail = null, hotelId = null, metadata = {} } = {}) {
  const id = String(agentId || '').trim().toLowerCase()
  if (!supabase?.from) throw new TypeError('Supabase client is required')
  if (!AGENTS.has(id)) throw new TypeError('Unknown Rand runtime unit')
  if (!['RUNNING','WAITING_APPROVAL','ERROR','OFFLINE','IDLE'].includes(status)) throw new TypeError('Invalid agent status')
  const now = new Date().toISOString()
  const { data: current, error: readError } = await supabase.from('randcore_agent_runtime').select('desired_state').eq('agent_id', id).maybeSingle()
  if (readError) throw readError
  const desiredState = current?.desired_state || 'RUNNING'
  const payload = { agent_id:id, status, heartbeat_at:now, task_id:taskId, activity, detail, hotel_id:hotelId, metadata, updated_at:now }
  const { error } = await supabase.from('randcore_agent_runtime').upsert(payload, { onConflict:'agent_id' })
  if (error) throw error
  return { agentId:id, desiredState, mayStartNewTask:desiredState !== 'PAUSED', heartbeatAt:now }
}
