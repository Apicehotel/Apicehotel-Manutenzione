import { supabase } from '../../supabase.js'
import { decryptDmAttachmentBlob, encryptDmAttachmentBlob } from './randmedia-crypto.js'

export const RANDMEDIA_MAX_FILE_BYTES = 20 * 1024 * 1024
export const RANDMEDIA_MAX_FILES = 4
export const RANDMEDIA_BUCKET = 'randchat-media'

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

const cleanName = (value) => String(value || 'allegato').replace(/[\\/\0]/g, '_').slice(0, 180) || 'allegato'
const extFromName = (name) => {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return match ? `.${match[1]}` : ''
}
const uuid = () => globalThis.crypto.randomUUID()

export function validateRandMediaFiles(files) {
  const list = Array.from(files || [])
  if (list.length > RANDMEDIA_MAX_FILES) throw new Error(`Massimo ${RANDMEDIA_MAX_FILES} allegati per messaggio`)
  for (const file of list) {
    if (!(file instanceof Blob) || file.size <= 0) throw new Error('Allegato vuoto')
    if (file.size > RANDMEDIA_MAX_FILE_BYTES) throw new Error('Ogni allegato può pesare al massimo 20 MB')
  }
  return list
}

const supabaseMediaProvider = Object.freeze({
  id: 'supabase',
  async upload(path, blob, contentType) {
    const client = ensureClient()
    const { error } = await client.storage.from(RANDMEDIA_BUCKET).upload(path, blob, {
      cacheControl: '3600', contentType: contentType || blob.type || 'application/octet-stream', upsert: false,
    })
    if (error) throw error
    return path
  },
  async remove(paths) {
    const list = (paths || []).filter(Boolean)
    if (!list.length) return
    const client = ensureClient()
    const { error } = await client.storage.from(RANDMEDIA_BUCKET).remove(list)
    if (error) throw error
  },
  async signedUrl(path, ttl = 3600) {
    const client = ensureClient()
    const { data, error } = await client.storage.from(RANDMEDIA_BUCKET).createSignedUrl(path, ttl)
    if (error) throw error
    return data?.signedUrl || null
  },
  async download(path) {
    const client = ensureClient()
    const { data, error } = await client.storage.from(RANDMEDIA_BUCKET).download(path)
    if (error) throw error
    return data
  },
})

// Single provider boundary. A future Telegram adapter only needs to satisfy this
// contract; chat UI, DB metadata and E2EE payloads do not depend on provider APIs.
export function getRandMediaProvider() { return supabaseMediaProvider }

export async function uploadGroupMediaFiles(files, { groupId, messageId } = {}) {
  const provider = getRandMediaProvider()
  const list = validateRandMediaFiles(files)
  const uploaded = []
  try {
    for (const file of list) {
      const id = uuid()
      const name = cleanName(file.name)
      const path = `group/${groupId}/${messageId}/${id}${extFromName(name)}`
      await provider.upload(path, file, file.type || 'application/octet-stream')
      uploaded.push({ id, storage_path: path, byte_size: file.size, content_type: file.type || 'application/octet-stream', display_name: name, encrypted: false })
    }
    return uploaded
  } catch (error) {
    await provider.remove(uploaded.map((row) => row.storage_path)).catch(() => {})
    throw error
  }
}

export async function prepareDmMediaFiles(files, { threadId, messageId } = {}) {
  const provider = getRandMediaProvider()
  const list = validateRandMediaFiles(files)
  const uploaded = []
  const secureDescriptors = []
  try {
    for (const file of list) {
      const id = uuid()
      const encrypted = await encryptDmAttachmentBlob(file)
      const path = `dm/${threadId}/${messageId}/${id}.bin`
      await provider.upload(path, encrypted.blob, 'application/octet-stream')
      uploaded.push({ id, storage_path: path, byte_size: encrypted.blob.size })
      secureDescriptors.push({
        id,
        name: cleanName(file.name),
        type: file.type || 'application/octet-stream',
        size: file.size,
        path,
        key: encrypted.key,
        iv: encrypted.iv,
      })
    }
    return { uploaded, secureDescriptors }
  } catch (error) {
    await provider.remove(uploaded.map((row) => row.storage_path)).catch(() => {})
    throw error
  }
}

export async function cleanupRandMediaUploads(rows) {
  await getRandMediaProvider().remove((rows || []).map((row) => row.storage_path || row.path)).catch(() => {})
}

export async function fetchGroupAttachments(groupId) {
  const client = ensureClient()
  const { data, error } = await client.from('chat_attachments').select('*').eq('scope', 'group').eq('group_id', groupId).order('created_at')
  if (error) throw error
  return data || []
}

export async function fetchDmAttachments(threadId) {
  const client = ensureClient()
  const { data, error } = await client.from('chat_attachments').select('*').eq('scope', 'dm').eq('dm_thread_id', threadId).order('created_at')
  if (error) throw error
  return data || []
}

export async function registerGroupAttachment({ groupId, messageId, attachment }) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_register_group_attachment', {
    p_id: attachment.id,
    p_group_id: groupId,
    p_message_id: messageId,
    p_storage_path: attachment.storage_path,
    p_byte_size: attachment.byte_size,
    p_content_type: attachment.content_type,
    p_display_name: attachment.display_name,
  })
  if (error) throw error
  return data
}

export async function groupAttachmentUrl(attachment) {
  return getRandMediaProvider().signedUrl(attachment.storage_path, 3600)
}

export async function decryptDmAttachment(attachment) {
  const cipherBlob = await getRandMediaProvider().download(attachment.path)
  return decryptDmAttachmentBlob(cipherBlob, {
    key: attachment.key,
    iv: attachment.iv,
    contentType: attachment.type,
  })
}

export function subscribeChatAttachments(groupId, onChange) {
  if (!supabase || !groupId) return () => {}
  const channel = supabase
    .channel(`randchat-media-${groupId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_attachments', filter: `group_id=eq.${groupId}` }, (payload) => onChange?.(payload))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
