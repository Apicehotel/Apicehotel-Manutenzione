import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adaptMcpToolCall, adaptRandChatMessage } from '../supabase/functions/_shared/rand-gateway/adapters.js'
import { approvalMatchesToolRequest } from '../supabase/functions/_shared/rand-gateway/approval-binding.js'
import { createRandEnvelope } from '../supabase/functions/_shared/rand-gateway/envelope.js'
import { RandGateway, RandGatewayError } from '../supabase/functions/_shared/rand-gateway/gateway.js'

function fixture({ actor = {}, authorize = null, replay = null } = {}) {
  const calls = { accepts: [], transitions: [], audits: [], identity: 0, tools: 0, hitlRequest: 0, hitlVerify: 0, actions: 0 }
  const store = {
    accept: async (entry) => { calls.accepts.push(entry); return replay ? { replayed: true, result: replay } : { replayed: false } },
    transition: async (...args) => calls.transitions.push(args),
    audit: async (entry) => calls.audits.push(entry),
  }
  const gateway = new RandGateway({
    store,
    identity: { resolve: async () => { calls.identity += 1; return actor } },
    tools: { authorize: async (request) => { calls.tools += 1; return authorize ? authorize(request) : { allowed: true, permission: 'READ', risk: 'LOW' } } },
    hitl: {
      request: async () => { calls.hitlRequest += 1; return { id: 'approval-1' } },
      verify: async () => { calls.hitlVerify += 1; return { approved: true } },
    },
    actions: { execute: async () => { calls.actions += 1; return { value: 42 } } },
  })
  return { gateway, calls }
}

const actor = { userId: 'user-1', hotelId: 'hotelgio', roleId: 'admin', scopes: ['issues:edit'], authenticated: true, identityConfidence: 'verified_session' }

test('adapters cannot self-assign authentication, risk or HITL decisions', () => {
  const envelope = createRandEnvelope({
    channel: 'randchat',
    actor: { userId: 'user-1', hotelId: 'hotelgio' },
    conversation: { type: 'group' },
    payload: { type: 'message', text: 'ciao' },
    security: { authenticated: true, riskLevel: 'LOW', hitlRequired: false },
  })
  assert.deepEqual(envelope.security, { authenticated: false, identityConfidence: 'none', riskLevel: 'UNKNOWN', hitlRequired: true })
})

test('normal RandChat messages are accepted without invoking tools or actions', async () => {
  const { gateway, calls } = fixture({ actor })
  const envelope = adaptRandChatMessage({ message: { id: crypto.randomUUID(), groupId: crypto.randomUUID(), body: 'Turno completato' }, actor, hotelId: 'hotelgio' })
  const result = await gateway.handle(envelope)
  assert.equal(result.status, 'accepted')
  assert.equal(calls.tools, 0)
  assert.equal(calls.actions, 0)
})

test('unauthenticated tool requests stop at identity HITL', async () => {
  const { gateway, calls } = fixture({ actor: { authenticated: false } })
  const envelope = adaptMcpToolCall({ serverId: 'external', hotelId: 'hotelgio', request: { name: 'issue.mark_done', requestId: 'r1' } })
  const result = await gateway.handle(envelope)
  assert.equal(result.status, 'pending_identity')
  assert.equal(calls.hitlRequest, 1)
  assert.equal(calls.tools, 0)
  assert.equal(calls.actions, 0)
})

test('resolved identity cannot cross hotel boundaries', async () => {
  const { gateway, calls } = fixture({ actor: { ...actor, hotelId: 'chocohotel' } })
  const envelope = adaptMcpToolCall({ serverId: 'rand-internal', actor, hotelId: 'hotelgio', request: { name: 'issue.update_priority', requestId: 'r2' } })
  await assert.rejects(gateway.handle(envelope), (error) => error instanceof RandGatewayError && error.code === 'RAND_GATEWAY_HOTEL_MISMATCH')
  assert.equal(calls.actions, 0)
})

test('canonical Tool Gateway denial stops before HITL and Action Gateway', async () => {
  const { gateway, calls } = fixture({ actor, authorize: async () => ({ allowed: false, code: 'DENIED_BY_RAND', reason: 'no' }) })
  const envelope = adaptMcpToolCall({ serverId: 'external', actor, hotelId: 'hotelgio', request: { name: 'unknown.tool', requestId: 'r3' } })
  await assert.rejects(gateway.handle(envelope), (error) => error.code === 'DENIED_BY_RAND')
  assert.equal(calls.hitlRequest, 0)
  assert.equal(calls.actions, 0)
})

test('protected mutations require approval and execute only on the second governed request', async () => {
  const authorize = async () => ({ allowed: true, permission: 'WRITE_PROTECTED', risk: 'HIGH', requiresHitl: true })
  const first = fixture({ actor, authorize })
  const pending = await first.gateway.handle(adaptMcpToolCall({ serverId: 'rand-internal', actor, hotelId: 'hotelgio', request: { name: 'issue.mark_done', requestId: 'r4' } }))
  assert.equal(pending.status, 'pending_approval')
  assert.equal(first.calls.actions, 0)
  assert.equal(pending.approval.id, 'approval-1')

  const second = fixture({ actor, authorize })
  const executed = await second.gateway.handle(adaptMcpToolCall({ serverId: 'rand-internal', actor, hotelId: 'hotelgio', request: { name: 'issue.mark_done', requestId: 'r5', approvalId: 'approval-1' } }))
  assert.equal(executed.status, 'executed')
  assert.equal(second.calls.hitlVerify, 1)
  assert.equal(second.calls.actions, 1)
})

test('high-risk and mutation tools cannot disable HITL through a bad policy flag', async () => {
  const { gateway, calls } = fixture({
    actor,
    authorize: async () => ({ allowed: true, permission: 'WRITE_PROTECTED', risk: 'HIGH', requiresHitl: false }),
  })
  const result = await gateway.handle(adaptMcpToolCall({
    serverId: 'rand-internal', actor, hotelId: 'hotelgio',
    request: { name: 'issue.mark_done', requestId: 'forced-hitl', arguments: { resourceId: crypto.randomUUID(), input: {} } },
  }))
  assert.equal(result.status, 'pending_approval')
  assert.equal(calls.actions, 0)
})

test('an approval is bound to the exact tool, resource and normalized input', () => {
  const resourceId = crypto.randomUUID()
  const approval = {
    action_type: 'issue.update_priority',
    resource_id: resourceId,
    payload: { action: { type: 'issue.update_priority', resourceId, input: { priority: 'alta', nested: { b: 2, a: 1 } } } },
  }
  assert.equal(approvalMatchesToolRequest(approval, {
    name: 'issue.update_priority',
    arguments: { resourceId, input: { nested: { a: 1, b: 2 }, priority: 'alta' } },
  }), true)
  assert.equal(approvalMatchesToolRequest(approval, {
    name: 'issue.mark_done', arguments: { resourceId, input: {} },
  }), false)
  assert.equal(approvalMatchesToolRequest(approval, {
    name: 'issue.update_priority', arguments: { resourceId: crypto.randomUUID(), input: { priority: 'alta' } },
  }), false)
  assert.equal(approvalMatchesToolRequest(approval, {
    name: 'issue.update_priority', arguments: { resourceId, input: { priority: 'bassa' } },
  }), false)
})

test('MCP annotations stay untrusted metadata and cannot downgrade Rand policy', async () => {
  let observed
  const { gateway } = fixture({ actor, authorize: async (request) => { observed = request; return { allowed: true, permission: 'WRITE_PROTECTED', risk: 'CRITICAL' } } })
  const envelope = adaptMcpToolCall({
    serverId: 'external', actor, hotelId: 'hotelgio',
    request: { name: 'issue.mark_done', requestId: 'r6', annotations: { readOnlyHint: true, destructiveHint: false } },
  })
  const result = await gateway.handle(envelope)
  assert.equal(result.status, 'pending_approval')
  assert.equal(observed.envelope.payload.toolRequest.externalAnnotations.readOnlyHint, true)
})

test('idempotency replay returns stored result without reauthorizing or executing', async () => {
  const { gateway, calls } = fixture({ actor, replay: { ok: true, status: 'executed', envelopeId: 'old' } })
  const result = await gateway.handle(adaptMcpToolCall({ serverId: 'rand-internal', actor, hotelId: 'hotelgio', request: { name: 'issue.mark_done', requestId: 'same' } }))
  assert.equal(result.replayed, true)
  assert.equal(calls.identity, 1)
  assert.equal(calls.tools, 0)
  assert.equal(calls.actions, 0)
})

test('idempotency is bound to the verified actor and external identifiers are not trusted', async () => {
  const { gateway, calls } = fixture({ actor })
  const envelope = adaptRandChatMessage({
    message: { id: 'provider-1', groupId: crypto.randomUUID(), body: 'ciao' },
    actor: { userId: 'spoofed-user' }, hotelId: 'hotelgio',
  })
  await gateway.handle(envelope)
  assert.match(calls.accepts[0].idempotencyKey, /:user-1:provider-1$/)
  assert.equal(calls.accepts[0].actor.userId, 'user-1')
})

test('oversized adapter metadata is rejected before persistence', async () => {
  const { gateway, calls } = fixture({ actor })
  await assert.rejects(gateway.handle({
    channel: 'randchat', actor: { hotelId: 'hotelgio' }, conversation: { type: 'group' },
    payload: { type: 'message', metadata: { value: 'x'.repeat(20_000) } },
  }), (error) => error.code === 'RAND_ENVELOPE_METADATA_TOO_LARGE')
  assert.equal(calls.accepts.length, 0)
})

test('Action Gateway failure is persisted and audited', async () => {
  const calls = { transitions: [], audits: [] }
  const gateway = new RandGateway({
    store: {
      accept: async () => ({ replayed: false }),
      transition: async (...entry) => calls.transitions.push(entry),
      audit: async (entry) => calls.audits.push(entry),
    },
    identity: { resolve: async () => actor },
    tools: { authorize: async () => ({ allowed: true, permission: 'READ', risk: 'LOW' }) },
    hitl: { request: async () => null, verify: async () => ({ approved: true }) },
    actions: { execute: async () => { throw Object.assign(new Error('down'), { code: 'ACTION_DOWN' }) } },
  })
  await assert.rejects(gateway.handle(adaptMcpToolCall({ serverId: 'rand-internal', actor, hotelId: 'hotelgio', request: { name: 'read.test', requestId: 'failure' } })))
  assert.equal(calls.transitions.at(-1)[1], 'failed')
  assert.equal(calls.audits.at(-1).code, 'ACTION_DOWN')
})

test('database contract is server-only, append-only and uses private Broadcast membership', () => {
  const migration = fs.readFileSync('supabase/migrations/20260912210819_randgateway_point7_foundation.sql', 'utf8')
  assert.match(migration, /rand_gateway_envelopes enable row level security/i)
  assert.match(migration, /revoke all on public\.rand_gateway_envelopes from public,anon,authenticated/i)
  assert.match(migration, /rand_gateway_audit is append-only/i)
  assert.match(migration, /realtime\.topic\(\)/i)
  assert.match(migration, /chat_group_member/i)
  assert.match(migration, /chat_dm_participant/i)
  assert.match(migration, /realtime\.broadcast_changes/i)
  assert.match(migration, /\[0-9a-f\]\{8\}.*\[0-9a-f\]\{12\}/i)
})

test('authenticated RandGateway endpoint requires active hotel membership and verifies HITL ownership', () => {
  const edge = fs.readFileSync('supabase/functions/rand-gateway/index.ts', 'utf8')
  assert.match(edge, /if \(!requestedHotel\).*hotel_required/)
  assert.match(edge, /if \(!membership\?\.active.*forbidden/)
  assert.match(edge, /requested_by_auth_user_id === actor\.userId/)
  assert.match(edge, /approval\.hotel_id === actor\.hotelId/)
  assert.match(edge, /approvalMatchesToolRequest/)
})

test('RandApp browser actions also use the canonical gateway instead of invoking the executor directly', () => {
  const client = fs.readFileSync('src/randai/action-gateway.js', 'utf8')
  const migration = fs.readFileSync('supabase/migrations/20260915041542_randgateway_randapp_ingress.sql', 'utf8')
  assert.match(client, /submitRandGatewayEnvelope/)
  assert.match(client, /channel: 'randapp'/)
  assert.doesNotMatch(client, /functions\.invoke\(['"]randai-action-gateway['"]/)
  assert.match(migration, /'randapp','internal','issue\.mark_done'/)
})

test('MCP uses the stable official SDK, Streamable HTTP and only the governed RandGateway', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const mcp = fs.readFileSync('api/mcp.js', 'utf8')
  assert.equal(pkg.dependencies['@modelcontextprotocol/sdk'], '1.30.0')
  assert.match(mcp, /StreamableHTTPServerTransport/)
  assert.match(mcp, /functions\/v1\/rand-gateway/)
  assert.match(mcp, /mcpServerId:\s*'rand-internal'/)
  assert.doesNotMatch(mcp, /service[_-]?role/i)
  assert.doesNotMatch(mcp, /from\(['"]segnalazioni['"]\)/i)
  assert.match(mcp, /MCP_ALLOWED_ORIGINS/)
  assert.match(mcp, /origin_not_allowed/)
})

test('Twilio inbound source cannot write directly to operational issues after final adapter wiring', () => {
  const edge = fs.readFileSync('supabase/functions/randai-whatsapp-inbound/index.ts', 'utf8')
  const retired = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8')
  assert.match(edge, /adaptTwilioInbound/)
  assert.match(edge, /whatsappGateway\(\)\.handle\(envelope\)/)
  assert.doesNotMatch(edge, /admin\.from\("segnalazioni"\)\.insert/)
  assert.match(retired, /legacy_whatsapp_webhook_retired/)
  assert.doesNotMatch(retired, /from\(["']segnalazioni["']\)/)
  assert.match(edge, /MAX_MEDIA_BYTES = 8 \* 1024 \* 1024/)
  assert.match(edge, /quarantine\/whatsapp/)
  assert.match(edge, /detected !== declared/)
})
