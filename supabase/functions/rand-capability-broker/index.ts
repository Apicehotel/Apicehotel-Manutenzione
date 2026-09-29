import { createClient } from 'npm:@supabase/supabase-js@2'
import { Client } from 'npm:@modelcontextprotocol/sdk@1.30.0/client/index.js'
import { StreamableHTTPClientTransport } from 'npm:@modelcontextprotocol/sdk@1.30.0/client/streamableHttp.js'

const url = Deno.env.get('SUPABASE_URL')!
const publishable = Deno.env.get('SUPABASE_ANON_KEY')!
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

const SERVER_CONFIG: Record<string, { url: string; tokenEnv?: string; headers?: Record<string,string> }> = Object.freeze({
  github: {
    url: 'https://api.githubcopilot.com/mcp/',
    tokenEnv: 'MCP_GITHUB_TOKEN',
    headers: { 'X-MCP-Readonly': 'true', 'X-MCP-Lockdown': 'true' },
  },
  supabase: {
    url: 'https://mcp.supabase.com/mcp?project_ref=ooqlfldcrnkudhgjnied&read_only=true&features=database,docs',
    tokenEnv: 'MCP_SUPABASE_TOKEN',
  },
  'digitalocean-apps': {
    url: 'https://apps.mcp.digitalocean.com/mcp',
    tokenEnv: 'MCP_DIGITALOCEAN_TOKEN',
  },
  sentry: { url: 'https://mcp.sentry.dev/mcp', tokenEnv: 'MCP_SENTRY_TOKEN' },
  context7: { url: 'https://mcp.context7.com/mcp', tokenEnv: 'MCP_CONTEXT7_TOKEN' },
  figma: { url: 'https://mcp.figma.com/mcp', tokenEnv: 'MCP_FIGMA_TOKEN' },
  bladewindui: { url: 'https://bladewindui.com/mcp/server' },
})

function userClient(req: Request) {
  return createClient(url, publishable, {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function safeInput(value: unknown) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('input_must_be_object')
  return value as Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  try {
    const client = userClient(req)
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401)

    const body = await req.json()
    const capability = clean(body?.capability, 120)
    const input = safeInput(body?.input)
    const requestedProvider = clean(input.provider, 80)
    const serverId = capability === 'deployment.inspect' && requestedProvider === 'vercel'
      ? 'vercel'
      : CAPABILITY_SERVER[capability]

    if (!serverId) return json({ ok: false, error: 'capability_not_allowed' }, 403)
    const config = serverId === 'vercel'
      ? { url: 'https://mcp.vercel.com', tokenEnv: 'MCP_VERCEL_TOKEN' }
      : SERVER_CONFIG[serverId]
    if (!config) return json({ ok: false, error: 'server_not_configured' }, 503)

    const token = config.tokenEnv ? clean(Deno.env.get(config.tokenEnv), 4096) : ''
    if (config.tokenEnv && !token) {
      return json({ ok: false, error: 'mcp_credentials_not_configured', detail: { serverId } }, 503)
    }

    const headers = new Headers(config.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers },
    })
    const mcp = new Client({ name: 'rand-capability-broker', version: '1.0.0' })
    await mcp.connect(transport)
    try {
      const tools = await mcp.listTools()
      const toolName = clean(input.tool, 180)
      if (!toolName) {
        const readable = (tools.tools || []).filter((tool: any) => tool?.annotations?.readOnlyHint === true)
          .map((tool: any) => ({ name: tool.name, description: tool.description || '', inputSchema: tool.inputSchema || {} }))
        return json({ ok: true, result: { serverId, tools: readable } })
      }
      const tool = (tools.tools || []).find((item: any) => item.name === toolName)
      if (!tool) return json({ ok: false, error: 'mcp_tool_not_found' }, 404)
      if (tool?.annotations?.readOnlyHint !== true) {
        return json({ ok: false, error: 'mcp_write_tool_denied', detail: { serverId, tool: toolName } }, 403)
      }
      const args = safeInput(input.arguments)
      const result = await mcp.callTool({ name: toolName, arguments: args })
      return json({ ok: true, result: { serverId, tool: toolName, output: result } })
    } finally {
      await mcp.close().catch(() => undefined)
    }
  } catch (error) {
    console.error('rand-capability-broker', error instanceof Error ? error.message : 'unknown')
    if (error instanceof SyntaxError) return json({ ok: false, error: 'invalid_json' }, 400)
    if (error instanceof TypeError && error.message === 'input_must_be_object') return json({ ok: false, error: 'invalid_input' }, 400)
    return json({ ok: false, error: 'mcp_broker_unavailable' }, 503)
  }
})
