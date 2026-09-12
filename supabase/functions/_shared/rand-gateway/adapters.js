import { createRandEnvelope } from './envelope.js'

export function adaptRandChatMessage({ message, actor, hotelId, conversationType = 'group' } = {}) {
  return createRandEnvelope({
    id: message?.gatewayEnvelopeId,
    channel: 'randchat',
    direction: 'inbound',
    actor: { ...actor, hotelId },
    conversation: { id: message?.groupId || message?.threadId, type: conversationType },
    payload: {
      type: 'message',
      text: message?.body,
      attachments: message?.attachments,
      metadata: { messageId: message?.id || null, encrypted: conversationType === 'dm' },
    },
    origin: { provider: 'supabase', providerMessageId: message?.id },
  })
}

export function adaptRandChatToolRequest({ request, actor, hotelId, conversation } = {}) {
  return createRandEnvelope({
    channel: 'randchat',
    direction: 'inbound',
    actor: { ...actor, hotelId },
    conversation,
    payload: { type: 'tool_request', text: request?.text, toolRequest: request },
    origin: { provider: 'randchat', providerMessageId: request?.messageId },
  })
}

export function adaptMcpToolCall({ serverId, request, actor, hotelId } = {}) {
  return createRandEnvelope({
    channel: 'mcp',
    direction: 'inbound',
    actor: { ...actor, hotelId },
    conversation: { id: request?.sessionId || null, type: 'system' },
    payload: {
      type: 'tool_request',
      toolRequest: {
        name: request?.name,
        arguments: request?.arguments,
        targetHotelId: request?.hotelId,
        approvalId: request?.approvalId,
        annotations: request?.annotations,
      },
      metadata: { protocol: 'mcp' },
    },
    origin: { provider: 'mcp', providerMessageId: request?.requestId, mcpServerId: serverId },
  })
}

export function adaptTwilioInbound({ params, hotelId, mediaPath = null } = {}) {
  const get = (name) => typeof params?.get === 'function' ? params.get(name) : params?.[name]
  const messageId = get('MessageSid') || get('SmsMessageSid')
  const contentType = get('MediaContentType0') || null
  const byteSize = Number(get('MediaSize0') || 0) || null
  return createRandEnvelope({
    channel: 'whatsapp',
    direction: 'inbound',
    actor: { externalId: get('From'), hotelId },
    conversation: { id: get('From'), type: 'dm' },
    payload: {
      type: 'message',
      text: get('Body'),
      attachments: mediaPath ? [{ name: 'media-0', contentType, byteSize, storagePath: mediaPath }] : [],
      metadata: { to: get('To'), numMedia: Number(get('NumMedia') || 0) },
    },
    origin: { provider: 'twilio', providerMessageId: messageId },
  })
}
