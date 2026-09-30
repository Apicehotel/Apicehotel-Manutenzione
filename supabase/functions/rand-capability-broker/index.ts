import { createClient } from 'npm:@supabase/supabase-js@2'
import { Client } from 'npm:@modelcontextprotocol/sdk@1.30.0/client/index.js'
import { StreamableHTTPClientTransport } from 'npm:@modelcontextprotocol/sdk@1.30.0/client/streamableHttp.js'
import {
  MCP_READ_POLICY, assertMcpHotel, assertMcpArguments, enabledMcpServer, isAllowedMcpTool,
} from '../_shared/mcp-read-policy.js'

const url = Deno.env.get('SUPABASE_URL')!
const publishable = Deno.env.get('SUPABASE_ANON_KEY')!
const getEnv = (name: string) => Deno.env.get(name) || ''
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const clean = (value: unknown, max = 300) => String(value ?? '').trim().slice(0, max)

const CAPABILITY_SERVER: Record<string, string> = Object.freeze({
  'repository.inspect': 'github',
  'database.inspect': 'supabase',
  'deployment.inspect': 'digitalocean-apps',
  'error.inspect': 'sentry',
  'docs.lookup': 'context7',
  'design.inspect': 'figma',
  'ui.reference': 'bladewindui',
})
const SERVER_CONFIG: Record<string, { url: string; tokenEnv?: string; headers?: Record<string, string> }> = Object.freeze({
  github: {
    url: 'https://api.githubcopilot.com/mcp/', tokenEnv: 'MCP_GITHUB_TOKEN',
    headers: { 'X-MCP-Readonly': 'true', 'X-MCP-Lockdown': 'true' },
  },
  supabase: {
    url: 'https://mcp.supabase.com/mcp?project_ref=ooqlfldcrnkudhgjnied&read_only=true&features=database,docs',
    tokenEnv: 'MCP_SUPABASE_TOKEN',
  },
  'digitalocean-apps': { url: 'https://apps.mcp.digitalocean.com/mcp', tokenEnv: 'MCP_DIGITALOCEAN_TOKEN' },
  sentry: { url: 'https://mcp.sentry.dev/mcp', tokenEnv: 'MCP_SENTRY_TOKEN' },
  context7: { url: 'https://mcp.context7.com/mcp', tokenEnv: 'MCP_CONTEXT7_TOKEN' },
  figma: { url: 'https://mcp.figma.com/mcp', tokenEnv: 'MCP_FIGMA_TOKEN' },
  bladewindui: { url: 'https://bladewindui.com/mcp/server' },
  vercel: { url: 'https://mcp.vercel.com', tokenEnv: 'MCP_VERCEL_TOKEN' },
})

function safeInput(value: unknown) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP_ARGUMENTS_INVALID')
  return value as Record<string, unknown>
}
function userClient(req: Request) {
  return createClient(url, publishable, {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
function configStatus() {
  return Object.entries(MCP_READ_POLICY).map(([id, allowedTools]) => {
    const cfg = SERVER_CONFIG[id]
    const enabled = enabledMcpServer(id, getEnv)
    const credentialsReady = !cfg?.tokenEnv || Boolean(getEnv(cfg.tokenEnv))
    return { serverId: id, enabled, credentialsReady, allowedToolCount: allowedTools.length,
      status: enabled && credentialsReady && allowedTools.length ? 'CONFIGURED_NOT_PROBED' : 'DISABLED' }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)
  try {
    const { data: userData, error: userError } = await userClient(req).auth.getUser()
    if (userError || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401)
    const body = await req.json()
    const capability = clean(body?.capability, 120)
    const hotelId = clean(body?.hotelId, 80)
    if (!hotelId) return json({ ok: false, error: 'hotel_required' }, 400)
    try { assertMcpHotel(hotelId) } catch { return json({ ok: false, error: 'hotel_not_allowed' }, 403) }

    const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRole) return json({ ok: false, error: 'broker_not_configured' }, 503)
    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: membership, error: membershipError } = await admin.from('hotel_memberships')
      .select('role,active').eq('auth_user_id', userData.user.id).eq('hotel_id', hotelId).maybeSingle()
    if (membershipError) throw membershipError
    if (!membership?.active || !['admin', 'RandAI'].includes(String(membership.role || ''))) {
      return json({ ok: false, error: 'mcp_infrastructure_forbidden' }, 403)
    }
    if (capability === 'broker.status') return json({ ok: true, result: { servers: configStatus() } })

    const input = safeInput(body?.input)
    const requestedProvider = clean(input.provider, 80)
    const serverId = capability === 'deployment.inspect' && requestedProvider === 'vercel'
      ? 'vercel' : CAPABILITY_SERVER[capability]
    if (!serverId || !Object.hasOwn(MCP_READ_POLICY, serverId)) {
      return json({ ok: false, error: 'capability_not_allowed' }, 403)
    }
    // Gate before contacting the remote server. No implicit activation from the repository registry.
    if (!enabledMcpServer(serverId, getEnv) || !MCP_READ_POLICY[serverId].length) {
      return json({ ok: false, error: 'mcp_server_disabled', detail: { serverId } }, 503)
    }
    const config = SERVER_CONFIG[serverId]
    if (!config) return json({ ok: false, error: 'server_not_configured' }, 503)
    const token = config.tokenEnv ? getEnv(config.tokenEnv) : ''
    if (config.tokenEnv && !token) {
      return json({ ok: false, error: 'mcp_credentials_not_configured', detail: { serverId } }, 503)
    }
    const toolName = clean(input.tool, 180)
    if (toolName && !MCP_READ_POLICY[serverId].includes(toolName)) {
      return json({ ok: false, error: 'mcp_tool_not_allowed' }, 403)
    }
    const args = toolName ? safeInput(input.arguments) : {}
    if (toolName) {
      try { assertMcpArguments(serverId, toolName, args) }
      catch { return json({ ok: false, error: 'mcp_arguments_denied' }, 403) }
    }
    const headers = new Headers(config.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers } })
    const mcp = new Client({ name: 'rand-capability-broker', version: '1.1.0' })
    await mcp.connect(transport)
    try {
      const listed = await mcp.listTools()
      const readable = (listed.tools || []).filter((tool: any) => isAllowedMcpTool(serverId, tool))
      if (!toolName) {
        return json({ ok: true, result: { serverId, tools: readable.map((tool: any) => ({
          name: tool.name, description: clean(tool.description, 500), inputSchema: tool.inputSchema || {},
        })) } })
      }
      if (!readable.some((tool: any) => tool.name === toolName)) {
        return json({ ok: false, error: 'mcp_write_tool_denied' }, 403)
      }
      const output = await mcp.callTool({ name: toolName, arguments: args })
      if (output.isError) return json({ ok: false, error: 'mcp_vendor_error' }, 502)
      const encoded = JSON.stringify(output)
      if (encoded.length > 65536) return json({ ok: false, error: 'mcp_response_too_large' }, 413)
      return json({ ok: true, result: { serverId, tool: toolName, output } })
    } finally {
      await mcp.close().catch(() => undefined)
    }
  } catch (error) {
    console.error('rand-capability-broker', error instanceof Error ? error.message : 'unknown')
    if (error instanceof SyntaxError) return json({ ok: false, error: 'invalid_json' }, 400)
    return json({ ok: false, error: 'mcp_broker_unavailable' }, 503)
  }
})
