import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { listRandActions, mapRandActionInput } from '../src/randai/actions/catalog.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const allowedOrigins = new Set(String(process.env.MCP_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean))

function mcpResult(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result?.ok !== true,
  }
}

function fieldSchema(field) {
  let schema
  if (field.kind === 'enum') schema = z.enum(field.values)
  else if (field.kind === 'string') {
    schema = z.string().trim()
    if (field.min != null) schema = schema.min(field.min)
    if (field.max != null) schema = schema.max(field.max)
  } else {
    throw new TypeError(`Unsupported Rand action field kind: ${field.kind}`)
  }
  return field.required === false ? schema.optional() : schema
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

  for (const action of listRandActions({ surface: 'mcp' })) {
    const actionFields = Object.fromEntries(action.fields.map((field) => [field.name, fieldSchema(field)]))
    server.registerTool(action.id, {
      title: action.title,
      description: action.description,
      inputSchema: { ...common, ...actionFields },
      annotations: action.annotations,
    }, async (args, extra) => {
      const { hotelId, resourceId, approvalId, ...actionInput } = args
      return mcpResult(await invoke({
        name: action.id,
        hotelId,
        resourceId,
        input: mapRandActionInput(action.id, actionInput),
        approvalId,
        requestId: extra.requestId,
      }))
    })
  }

  return server
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS')
    res.status(204).end()
    return
  }
  const origin = String(req.headers.origin || '').trim()
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ error: 'origin_not_allowed' })
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
