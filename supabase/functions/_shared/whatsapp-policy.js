export const normalizeWhatsAppNumber = (value) => {
  const raw = String(value || '').trim().replace(/^whatsapp:/i, '')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (raw.startsWith('+')) return `+${digits}`
  if (digits.startsWith('39')) return `+${digits}`
  return `+39${digits}`
}

export const channelOperationalState = (channel) => {
  if (!channel?.inbound_number) return 'NOT_CONFIGURED'
  if (!channel.receive_enabled) return 'DISABLED'
  if (!channel.ingestion_enabled) return 'PAUSED'
  return 'ACTIVE'
}

export function resolveInboundChannel(rows, destination) {
  const toNumber = normalizeWhatsAppNumber(destination)
  if (!toNumber) return Object.freeze({ ok: false, reason: 'INVALID_DESTINATION', channel: null })
  const matches = (Array.isArray(rows) ? rows : []).filter((row) => normalizeWhatsAppNumber(row?.inbound_number) === toNumber)
  if (matches.length === 0) return Object.freeze({ ok: false, reason: 'CHANNEL_NOT_FOUND', channel: null })
  if (matches.length > 1) return Object.freeze({ ok: false, reason: 'AMBIGUOUS_CHANNEL', channel: null })
  const channel = matches[0]
  if (!channel?.hotel_id) return Object.freeze({ ok: false, reason: 'CHANNEL_WITHOUT_HOTEL', channel: null })
  const state = channelOperationalState(channel)
  if (state === 'NOT_CONFIGURED' || state === 'DISABLED') return Object.freeze({ ok: false, reason: state, channel: null })
  return Object.freeze({ ok: true, reason: state, channel: Object.freeze({ ...channel, inbound_number: toNumber }) })
}

export function publicChannelSnapshot(channel) {
  return Object.freeze({
    hotel_id: String(channel?.hotel_id || ''),
    inbound_number: normalizeWhatsAppNumber(channel?.inbound_number),
    receive_enabled: Boolean(channel?.receive_enabled),
    ingestion_enabled: Boolean(channel?.ingestion_enabled),
    state: channelOperationalState(channel),
    updated_at: channel?.updated_at || null,
  })
}
