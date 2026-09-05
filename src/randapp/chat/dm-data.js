import { supabase } from '../../supabase.js'
import { fetchChatDirectory } from './chat-data.js'
import { decryptDmPayload, encryptDmPayload } from './dm-crypto-core.js'
import { ensureDmDeviceIdentity } from './dm-device-store.js'
import { decodeDmMessagePayload, encodeDmMessagePayload } from './dm-payload.js'
import { cleanupRandMediaUploads, fetchDmAttachments, prepareDmMediaFiles } from './randmedia.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

export function normalizeDmRetentionDays(value) {
  const days = Number(value)
  return days === 1 || days === 15 ? days : 7
}

export async function ensureRegisteredDmDevice(userId) {
  const client = ensureClient()
  const identity = await ensureDmDeviceIdentity(userId)
  const { data, error } = await client.rpc('chat_dm_register_device', {
    p_device_id: identity.deviceId,
    p_encryption_public_key_jwk: identity.encryptionPublicKeyJwk,
    p_signing_public_key_jwk: identity.signingPublicKeyJwk,
  })
  if (error) throw error
  return { ...identity, serverDeviceRowId: data }
}

export async function fetchDmDirectory() {
  return fetchChatDirectory()
}

export async function fetchDmThreads() {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_dm_list_threads')
  if (error) throw error
  return data || []
}

export async function openDmThread(otherUserId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_dm_open_thread', { p_other_user_id: otherUserId })
  if (error) throw error
  return data
}

export async function fetchDmDevices(threadId) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_dm_list_devices', { p_thread_id: threadId })
  if (error) throw error
  return data || []
}

function cryptoFallback(error) {
  if (error?.code === 'NO_DEVICE_ENVELOPE') return 'Messaggio precedente a questo dispositivo'
  if (error?.code === 'BAD_SIGNATURE') return 'Messaggio bloccato: firma non valida'
  if (error?.code === 'KEY_UNWRAP_FAILED') return 'Messaggio non decifrabile su questo dispositivo'
  return 'Messaggio cifrato non disponibile'
}

export async function fetchDmMessages(threadId, userId, limit = 120) {
  const client = ensureClient()
  const device = await ensureRegisteredDmDevice(userId)
  const [{ data, error }, attachmentRows] = await Promise.all([
    client.rpc('chat_dm_list_messages', {
      p_thread_id: threadId,
      p_device_id: device.deviceId,
      p_limit: Math.min(Math.max(Number(limit) || 120, 1), 300),
    }),
    fetchDmAttachments(threadId),
  ])
  if (error) throw error
  const attachmentById = new Map((attachmentRows || []).map((row) => [row.id, row]))
  const messages = await Promise.all((data || []).map(async (row) => {
    try {
      const plaintext = await decryptDmPayload({
        message: row,
        deviceRowId: device.serverDeviceRowId,
        encryptionPrivateKey: device.encryptionPrivateKey,
      })
      const payload = decodeDmMessagePayload(plaintext)
      const attachments = payload.attachments.filter((descriptor) => {
        const server = attachmentById.get(descriptor.id)
        return server && server.dm_message_id === row.id && server.storage_path === descriptor.path && server.encrypted === true
      })
      return {
        ...row,
        body: payload.text || (attachments.length ? 'Allegato cifrato' : ''),
        attachments,
        payloadVersion: payload.version,
        cryptoState: 'verified',
      }
    } catch (cryptoError) {
      return {
        ...row,
        body: cryptoFallback(cryptoError),
        attachments: [],
        cryptoState: cryptoError?.code === 'NO_DEVICE_ENVELOPE' ? 'unavailable' : 'invalid',
        cryptoError: cryptoError?.code || 'DECRYPT_FAILED',
      }
    }
  }))
  return { messages, device }
}

export async function sendDmMessage({ threadId, userId, body, files = [] }) {
  const client = ensureClient()
  const text = String(body || '').trim()
  const fileList = Array.from(files || [])
  if (!text && !fileList.length) return null
  const device = await ensureRegisteredDmDevice(userId)
  const devices = await fetchDmDevices(threadId)
  const messageId = globalThis.crypto.randomUUID()
  let media = { uploaded: [], secureDescriptors: [] }
  try {
    media = await prepareDmMediaFiles(fileList, { threadId, messageId })
    const plaintext = encodeDmMessagePayload({ text, attachments: media.secureDescriptors })
    const encrypted = await encryptDmPayload({
      threadId,
      messageId,
      senderUserId: userId,
      senderDeviceRowId: device.serverDeviceRowId,
      plaintext,
      devices,
      signingPrivateKey: device.signingPrivateKey,
    })
    const { data, error } = await client.rpc('chat_dm_send_message_v2', {
      p_thread_id: threadId,
      p_message_id: messageId,
      p_sender_device_id: device.serverDeviceRowId,
      p_ciphertext: encrypted.ciphertext,
      p_content_iv: encrypted.contentIv,
      p_ephemeral_public_key_jwk: encrypted.ephemeralPublicKeyJwk,
      p_signature: encrypted.signature,
      p_envelopes: encrypted.envelopes,
      p_attachments: media.uploaded,
    })
    if (error) throw error
    return data || messageId
  } catch (error) {
    await cleanupRandMediaUploads(media.uploaded)
    throw error
  }
}

export async function setDmRetention(threadId, days) {
  const client = ensureClient()
  const { error } = await client.rpc('chat_dm_set_retention', {
    p_thread_id: threadId,
    p_retention_days: normalizeDmRetentionDays(days),
  })
  if (error) throw error
}

export async function linkChatMessageToIssue({ sourceType, sourceId, sourceMessageId, issueId, hotelId }) {
  const client = ensureClient()
  const { data, error } = await client.rpc('chat_link_issue', {
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_source_message_id: sourceMessageId,
    p_issue_id: issueId,
    p_hotel_id: hotelId,
  })
  if (error) throw error
  return data
}

export function subscribeDmThread(threadId, onChange) {
  if (!supabase || !threadId) return () => {}
  const channel = supabase
    .channel(`randchat-dm-${threadId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_dm_messages', filter: `thread_id=eq.${threadId}` }, (payload) => onChange?.(payload))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
