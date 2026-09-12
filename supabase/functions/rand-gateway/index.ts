import { createClient } from 'npm:@supabase/supabase-js@2'
import { RandGateway, RandGatewayError } from '../_shared/rand-gateway/gateway.js'
import { createSupabaseGatewayStore } from '../_shared/rand-gateway/supabase-store.js'

const url = Deno.env.get('SUPABASE_URL')!
const publishable = Deno.env.get('SUPABASE_ANON_KEY')!
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max)

function userClient(req: Request) {
  return createClient(url, publishable, {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function forwardActionGateway(req: Request, body: Record<string, unknown>) {
  const response = await fetch(`${url}/functions/v1/randai-action-gateway`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: req.headers.get('authorization') || '',
      apikey: publishable,
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({ ok: false, error: 'invalid_action_gateway_response' }))
  if (!response.ok || !data?.ok) throw new RandGatewayError(data?.error || 'RAND_ACTION_GATEWAY_FAILED', 'Action Gateway non disponibile', data)
  return data
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)
  try {
    const body = await req.json()
    const channel = clean(body?.channel, 30).toLowerCase()
    if (!['randchat', 'mcp'].includes(channel)) return json({ ok: false, error: 'adapter_not_allowed' }, 403)
    const client = userClient(req)
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401)
    const requestedHotel = clean(body?.actor?.hotelId || body?.actor?.hotel_id, 80)

    const identity = {
      async resolve() {
        if (!requestedHotel) return { authenticated: false, identityConfidence: 'none' }
        const [{ data: membership, error: membershipError }, { data: profile }] = await Promise.all([
          admin.from('hotel_memberships').select('role,active').eq('auth_user_id', userData.user.id).eq('hotel_id', requestedHotel).maybeSingle(),
          admin.from('profiles').select('active').eq('auth_user_id', userData.user.id).maybeSingle(),
        ])
        if (membershipError) throw membershipError
        if (!membership?.active || profile?.active === false) return { authenticated: false, identityConfidence: 'none' }
        const { data: permissions, error: permissionError } = await admin.from('role_permissions')
          .select('module,action,allowed').eq('role', membership.role).eq('allowed', true)
        if (permissionError) throw permissionError
        return {
          userId: userData.user.id,
          hotelId: requestedHotel,
          roleId: membership.role,
          scopes: (permissions || []).map((row: any) => `${row.module}:${row.action}`),
          authenticated: true,
          identityConfidence: 'verified_session',
        }
      },
    }

    const tools = {
      async authorize({ envelope, toolName, hotelId, targetHotelId, grantedScopes }: any) {
        if (hotelId !== targetHotelId) return { allowed: false, code: 'RAND_GATEWAY_CROSS_HOTEL_DENIED', reason: 'Accesso cross-hotel vietato' }
        const serverId = envelope.channel === 'mcp' ? clean(envelope.origin.mcpServerId, 180) : 'internal'
        if (!serverId) return { allowed: false, code: 'RAND_MCP_SERVER_REQUIRED', reason: 'Server MCP non specificato' }
        if (envelope.channel === 'mcp' && serverId !== 'rand-internal') {
          const { data: server } = await admin.from('rand_mcp_servers').select('enabled,allowed_hotel_ids').eq('id', serverId).maybeSingle()
          if (!server?.enabled || !(server.allowed_hotel_ids || []).includes(hotelId)) {
            return { allowed: false, code: 'RAND_MCP_SERVER_DENIED', reason: 'Server MCP non autorizzato per la struttura' }
          }
        }
        const { data: policy, error } = await admin.from('rand_gateway_tool_policies').select('*')
          .eq('channel', envelope.channel).eq('server_id', serverId).eq('tool_name', toolName).maybeSingle()
        if (error) throw error
        if (!policy?.enabled) return { allowed: false, code: 'RAND_GATEWAY_TOOL_DISABLED', reason: 'Tool non presente nella allowlist Rand' }
        const granted = new Set(grantedScopes || [])
        const missing = (policy.required_scopes || []).filter((scope: string) => !granted.has(scope))
        if (missing.length) return { allowed: false, code: 'RAND_GATEWAY_SCOPE_DENIED', reason: 'Permessi insufficienti', missingScopes: missing }
        return { allowed: true, permission: policy.permission, risk: policy.risk, requiresHitl: policy.requires_hitl, executor: policy.executor }
      },
    }

    const hitl = {
      async request({ envelope, actor, decision, reason }: any) {
        if (!actor?.authenticated || !decision || decision.executor !== 'randai_action_gateway') {
          const id = `HITL-${crypto.randomUUID()}`
          await admin.from('rand_gateway_queue').insert({ envelope_id: envelope.id, queue_name: 'rand_gateway_hitl' })
          return { id, reason }
        }
        const tool = envelope.payload.toolRequest
        const resourceId = clean(tool.arguments?.resourceId || tool.arguments?.resource_id, 120)
        const plan = (await forwardActionGateway(req, {
          operation: 'prepare',
          hotel_id: actor.hotelId,
          action: { type: tool.name, resource_id: resourceId, input: tool.arguments?.input || {} },
          context: { hotelId: actor.hotelId, source: 'randapp', version: 1, screen: { view: 'issues' }, resource: { type: 'issue', id: resourceId } },
        })).plan
        return { ...plan, id: plan?.approval_id || null }
      },
      async verify({ approvalId }: any) {
        return { approved: Boolean(clean(approvalId, 180)) }
      },
    }

    const actions = {
      async execute({ envelope, actor }: any) {
        const request = envelope.payload.toolRequest
        return forwardActionGateway(req, { operation: 'execute', hotel_id: actor.hotelId, approval_id: request.approvalId })
      },
    }

    const gateway = new RandGateway({ store: createSupabaseGatewayStore(admin), identity, tools, hitl, actions })
    return json(await gateway.handle(body))
  } catch (error) {
    console.error('rand-gateway', error instanceof Error ? error.message : 'unknown')
    if (error instanceof RandGatewayError) return json({ ok: false, error: error.code, detail: error.details }, 403)
    return json({ ok: false, error: 'rand_gateway_unavailable' }, 500)
  }
})
