import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createHash } from 'node:crypto'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

function mcpResult(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result?.ok !== true,
  }
}

export function createRandMcpServer({ authorization, dispatch = null } = {}) {
  const server = new McpServer({ name: 'rand-mcp', version: '1.0.0' })
  const callerFingerprint = createHash('sha256').update(String(authorization || '')).digest('hex').slice(0, 24)
  const invoke = dispatch || (async ({ name, hotelId, resourceId, input, approvalId, requestId }) => {
    if (!supabaseUrl || !publishableKey) return { ok: false, error: 'mcp_gateway_not_configured' }
    const response = await fetch(`${supabaseUrl}/functions/v1/rand-gateway`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization, apikey: publishableKey },
      body: JSON.stringify({
        channel: 'mcp',
        direction: 'inbound',
        actor: { hotelId },
        conversation: { type: 'system' },
        payload: {
          type: 'tool_request',
          toolRequest: { name, targetHotelId: hotelId, arguments: { resourceId, input }, approvalId },
        },
        origin: { provider: 'mcp', mcpServerId: 'rand-internal', providerMessageId: `${callerFingerprint}:${String(requestId || crypto.randomUUID())}` },
      }),
    })
    return response.json().catch(() => ({ ok: false, error: 'invalid_rand_gateway_response' }))
  })

  const common = {
    hotelId: z.enum(['hotelgio', 'chocohotel', 'brigantino']).describe('Hotel Rand autorizzato'),
    resourceId: z.string().uuid().describe('UUID della segnalazione'),
    approvalId: z.string().max(180).optional().describe('ID restituito dal primo passaggio HITL'),
  }

  server.registerTool('issue.update_priority', {
    title: 'Cambia urgenza segnalazione',
    description: 'Prepara o esegue, dopo conferma Rand, una modifica di urgenza hotel-scoped.',
    inputSchema: { ...common, priority: z.enum(['alta', 'media', 'bassa']) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ hotelId, resourceId, priority, approvalId }, extra) => mcpResult(await invoke({
    name: 'issue.update_priority', hotelId, resourceId, input: { priority }, approvalId, requestId: extra.requestId,
  })))

  server.registerTool('issue.set_waiting_part', {
    title: 'Segnalazione in attesa ricambio',
    description: 'Prepara o esegue, dopo conferma Rand, lo stato di attesa ricambio.',
    inputSchema: { ...common, partName: z.string().trim().min(1).max(180) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ hotelId, resourceId, partName, approvalId }, extra) => mcpResult(await invoke({
    name: 'issue.set_waiting_part', hotelId, resourceId, input: { part_name: partName }, approvalId, requestId: extra.requestId,
  })))

  server.registerTool('issue.mark_done', {
    title: 'Completa segnalazione',
    description: 'Prepara o esegue, dopo conferma Rand, il completamento di una segnalazione.',
    inputSchema: { ...common, completionNote: z.string().trim().max(800).optional() },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ hotelId, resourceId, completionNote, approvalId }, extra) => mcpResult(await invoke({
    name: 'issue.mark_done', hotelId, resourceId, input: { completion_note: completionNote || null }, approvalId, requestId: extra.requestId,
  })))

  return server
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS')
    res.status(204).end()
    return
  }
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ') || authorization.length < 32) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="RandMCP"')
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  const server = createRandMcpServer({ authorization })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    console.error('rand-mcp', error)
    if (!res.headersSent) res.status(500).json({ error: 'mcp_unavailable' })
  }
}
