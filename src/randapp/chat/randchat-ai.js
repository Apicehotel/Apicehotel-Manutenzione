import { supabase } from '../../supabase.js'
import { retrieveRandAIGuidance } from '../../randai/randai-data.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

const formatContext = (context) => {
  const messages = (context?.messages || []).map((message) => `${message.sender}: ${message.body}`).join('\n')
  const procedures = (context?.procedures || []).map((row) => {
    const p = row.snapshot || {}
    return `Procedura condivisa: ${p.title || row.procedure_id} v${row.version || ''} — ${p.summary || ''}`
  }).join('\n')
  const issues = (context?.issue_links || []).map((row) => `Segnalazione collegata: ${row.issue_id}`).join('\n')
  return [`Gruppo operativo: ${context?.group_name || ''}`, messages, procedures, issues].filter(Boolean).join('\n').slice(-14000)
}

export async function getAuthorizedGroupAiContext(groupId, limit = 30) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_group_ai_context', { p_group_id: groupId, p_limit: Math.min(Math.max(Number(limit) || 30, 1), 50) })
  if (error) throw error
  return data || null
}

export async function askRandAIAboutGroup({ groupId, query }) {
  const question = String(query || '').trim()
  if (!question) throw new Error('Scrivi cosa vuoi chiedere a RandAI')
  const context = await getAuthorizedGroupAiContext(groupId)
  if (!context?.hotel_id) throw new Error('Contesto gruppo non disponibile')
  const guidance = await retrieveRandAIGuidance({
    hotelId: context.hotel_id,
    query: question,
    contextQuery: formatContext(context),
  })
  return { context, guidance }
}
