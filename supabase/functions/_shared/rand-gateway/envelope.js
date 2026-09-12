const CHANNELS = new Set(['randchat', 'whatsapp', 'email', 'mcp', 'system'])
const DIRECTIONS = new Set(['inbound', 'outbound'])
const CONVERSATION_TYPES = new Set(['dm', 'group', 'event', 'system'])
const PAYLOAD_TYPES = new Set(['message', 'tool_request', 'tool_result', 'notification', 'system_event'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max)
const clone = (value) => value == null ? value : structuredClone(value)
const uuid = () => globalThis.crypto.randomUUID()

export class RandEnvelopeError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'RandEnvelopeError'
    this.code = code
    this.details = clone(details)
  }
}

function invalid(code, message, details) {
  throw new RandEnvelopeError(code, message, details)
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return []
  if (value.length > 4) invalid('RAND_ENVELOPE_TOO_MANY_ATTACHMENTS', 'Massimo quattro allegati per envelope')
  return value.map((item) => Object.freeze({
    id: clean(item?.id, 120) || null,
    name: clean(item?.name, 255) || null,
    contentType: clean(item?.contentType || item?.content_type, 120) || null,
    byteSize: Number.isFinite(Number(item?.byteSize ?? item?.byte_size)) ? Number(item?.byteSize ?? item?.byte_size) : null,
    storagePath: clean(item?.storagePath || item?.storage_path, 800) || null,
    quarantineStatus: 'pending',
  }))
}

function normalizeToolRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const name = clean(value.name || value.toolName || value.tool_name, 180)
  if (!name) invalid('RAND_ENVELOPE_TOOL_REQUIRED', 'Nome tool obbligatorio')
  return Object.freeze({
    name,
    arguments: clone(value.arguments && typeof value.arguments === 'object' ? value.arguments : {}),
    targetHotelId: clean(value.targetHotelId || value.target_hotel_id, 80) || null,
    approvalId: clean(value.approvalId || value.approval_id, 180) || null,
    externalAnnotations: clone(
      value.externalAnnotations && typeof value.externalAnnotations === 'object'
        ? value.externalAnnotations
        : value.annotations && typeof value.annotations === 'object' ? value.annotations : {},
    ),
  })
}

export function createRandEnvelope(input = {}) {
  const channel = clean(input.channel, 30).toLowerCase()
  const direction = clean(input.direction || 'inbound', 20).toLowerCase()
  const conversationType = clean(input.conversation?.type || 'system', 20).toLowerCase()
  const payloadType = clean(input.payload?.type || 'message', 30).toLowerCase()
  if (!CHANNELS.has(channel)) invalid('RAND_ENVELOPE_CHANNEL_INVALID', 'Canale Rand non valido', { channel })
  if (!DIRECTIONS.has(direction)) invalid('RAND_ENVELOPE_DIRECTION_INVALID', 'Direzione Rand non valida', { direction })
  if (!CONVERSATION_TYPES.has(conversationType)) invalid('RAND_ENVELOPE_CONVERSATION_INVALID', 'Conversazione Rand non valida', { conversationType })
  if (!PAYLOAD_TYPES.has(payloadType)) invalid('RAND_ENVELOPE_PAYLOAD_INVALID', 'Payload Rand non valido', { payloadType })

  const requestedId = clean(input.id, 120)
  if (requestedId && !UUID.test(requestedId)) invalid('RAND_ENVELOPE_ID_INVALID', 'Envelope id deve essere UUID')
  const id = requestedId || uuid()
  const traceId = clean(input.traceId || input.trace_id, 120) || id
  const actor = input.actor && typeof input.actor === 'object' ? input.actor : {}
  const conversation = input.conversation && typeof input.conversation === 'object' ? input.conversation : {}
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {}
  const origin = input.origin && typeof input.origin === 'object' ? input.origin : {}

  return Object.freeze({
    version: 1,
    id,
    traceId,
    timestamp: clean(input.timestamp, 80) || new Date().toISOString(),
    channel,
    direction,
    actor: Object.freeze({
      externalId: clean(actor.externalId || actor.external_id, 255) || null,
      userId: clean(actor.userId || actor.user_id, 120) || null,
      hotelId: clean(actor.hotelId || actor.hotel_id, 80) || null,
      roleId: clean(actor.roleId || actor.role_id, 120) || null,
    }),
    conversation: Object.freeze({
      id: clean(conversation.id, 180) || null,
      type: conversationType,
    }),
    payload: Object.freeze({
      type: payloadType,
      text: clean(payload.text, 8000) || null,
      attachments: Object.freeze(normalizeAttachments(payload.attachments)),
      toolRequest: normalizeToolRequest(payload.toolRequest || payload.tool_request),
      metadata: clone(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    }),
    // An adapter can report identifiers and content, but it cannot grant trust.
    security: Object.freeze({
      authenticated: false,
      identityConfidence: 'none',
      riskLevel: 'UNKNOWN',
      hitlRequired: true,
    }),
    origin: Object.freeze({
      provider: clean(origin.provider, 80) || channel,
      providerMessageId: clean(origin.providerMessageId || origin.provider_message_id, 255) || null,
      mcpServerId: clean(origin.mcpServerId || origin.mcp_server_id, 180) || null,
    }),
  })
}

export function envelopeIdempotencyKey(envelope) {
  const providerId = envelope?.origin?.providerMessageId
  return providerId
    ? [
      envelope.channel,
      envelope.origin.provider,
      envelope.origin.mcpServerId || '-',
      envelope.actor.hotelId || '-',
      envelope.conversation.id || '-',
      providerId,
    ].join(':')
    : `${envelope.channel}:${envelope.id}`
}

export const RandEnvelopeChannels = Object.freeze([...CHANNELS])
