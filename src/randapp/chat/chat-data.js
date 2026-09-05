import { supabase } from '../../supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

export function normalizeRetentionDays(value) {
  return Number(value) === 60 ? 60 : 30
}

export async function fetchChatGroups() {
  const client = ensureClient()
  const { data, error } = await client.from('chat_groups').select('*').is('archived_at', null).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createChatGroup({ hotelId, name, description = null, retentionDays = 30 }) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_create_group', {
    p_hotel_id: hotelId,
    p_name: String(name || '').trim(),
    p_description: description ? String(description).trim() : null,
    p_retention_days: normalizeRetentionDays(retentionDays),
  })
  if (error) throw error
  return data
}

export async function updateChatGroup(groupId, { name = null, description = null, retentionDays = null } = {}) {
  const client = ensureClient()
  const { error } = await client.rpc('chat_update_group', {
    p_group_id: groupId,
    p_name: name == null ? null : String(name).trim(),
    p_description: description == null ? null : String(description).trim(),
    p_retention_days: retentionDays == null ? null : normalizeRetentionDays(retentionDays),
  })
  if (error) throw error
}

export async function fetchChatMessages(groupId, limit = 120) {
  const client = ensureClient()
  const { data, error } = await client.from('chat_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(Number(limit) || 120, 1), 300))
  if (error) throw error
  return data || []
}

export async function sendChatMessage(groupId, senderUserId, body) {
  const client = ensureClient()
  const text = String(body || '').trim()
  if (!text) return null
  const { data, error } = await client.from('chat_messages')
    .insert({ group_id: groupId, sender_user_id: senderUserId, body: text })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteChatMessage(messageId) {
  const client = ensureClient()
  const { error } = await client.from('chat_messages').delete().eq('id', messageId)
  if (error) throw error
}

export async function setChatMessagePinned(messageId, pinned) {
  const client = ensureClient()
  const { error } = await client.rpc('chat_set_message_pinned', { p_message_id: messageId, p_pinned: Boolean(pinned) })
  if (error) throw error
}

export async function fetchChatDirectory() {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_list_directory')
  if (error) throw error
  return data || []
}

export async function fetchChatGroupMembers(groupId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_list_group_members', { p_group_id: groupId })
  if (error) throw error
  return data || []
}

export async function addChatGroupMember(groupId, authUserId, role = 'member') {
  const client = ensureClient()
  const { error } = await client.rpc('chat_add_group_member', { p_group_id: groupId, p_auth_user_id: authUserId, p_role: role === 'admin' ? 'admin' : 'member' })
  if (error) throw error
}

export async function removeChatGroupMember(groupId, authUserId) {
  const client = ensureClient()
  const { error } = await client.rpc('chat_remove_group_member', { p_group_id: groupId, p_auth_user_id: authUserId })
  if (error) throw error
}

export async function setChatGroupMemberRole(groupId, authUserId, role) {
  const client = ensureClient()
  const { error } = await client.rpc('chat_set_group_member_role', { p_group_id: groupId, p_auth_user_id: authUserId, p_role: role === 'admin' ? 'admin' : 'member' })
  if (error) throw error
}

export async function fetchShareableProcedures(groupId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_list_shareable_procedures', { p_group_id: groupId })
  if (error) throw error
  return data || []
}

export async function shareProcedureToGroup(groupId, procedureId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_share_procedure', { p_group_id: groupId, p_procedure_id: procedureId })
  if (error) throw error
  return data
}

export async function fetchGroupProcedureLinks(groupId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_list_group_procedures', { p_group_id: groupId })
  if (error) throw error
  return data || []
}

export function subscribeChatGroup(groupId, { onMessage, onMessageChange, onMembershipChange } = {}) {
  if (!supabase || !groupId) return () => {}
  const channel = supabase
    .channel(`randchat-${groupId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, (payload) => onMessage?.(payload.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, (payload) => onMessageChange?.(payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members', filter: `group_id=eq.${groupId}` }, (payload) => onMembershipChange?.(payload))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
