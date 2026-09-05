import { supabase } from '../../supabase.js'
import { structureProcedureDraft } from '../../randai/guidance/authoring.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

export async function createProcedureDraftFromMessage({ groupId, messageId, hotelId, text, title = '', category = 'generale', area = null }) {
  const structured = structureProcedureDraft(String(text || ''), { hotelId, title, category, area })
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_create_procedure_draft', {
    p_group_id: groupId,
    p_message_id: messageId,
    p_title: structured.title,
    p_summary: structured.summary,
    p_steps: structured.steps,
    p_category: structured.category,
    p_area: structured.area,
  })
  if (error) throw error
  return { id: data, draft: structured, requiresApproval: true }
}
