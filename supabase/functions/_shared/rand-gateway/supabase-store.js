export function createSupabaseGatewayStore(admin) {
  if (!admin?.from) throw new TypeError('Supabase admin client is required')
  return Object.freeze({
    async accept({ envelope, idempotencyKey }) {
      const row = {
        id: envelope.id,
        trace_id: envelope.traceId,
        envelope_version: envelope.version,
        channel: envelope.channel,
        direction: envelope.direction,
        actor_auth_user_id: null,
        actor_external_id: envelope.actor.externalId,
        hotel_id: envelope.actor.hotelId,
        role_id: null,
        conversation: envelope.conversation,
        payload: envelope.payload,
        security: envelope.security,
        origin: envelope.origin,
        idempotency_key: idempotencyKey,
      }
      const { error } = await admin.from('rand_gateway_envelopes').insert(row)
      if (!error) return { replayed: false }
      if (String(error.code || '') !== '23505') throw error
      const { data, error: readError } = await admin.from('rand_gateway_envelopes')
        .select('id,status,result').eq('idempotency_key', idempotencyKey).single()
      if (readError) throw readError
      return { replayed: true, result: data?.result || { ok: true, status: data?.status || 'accepted', envelopeId: data?.id } }
    },
    async transition(envelopeId, status, detail = {}) {
      const actor = detail?.actor || {}
      const { error } = await admin.from('rand_gateway_envelopes').update({
        status,
        actor_auth_user_id: actor.userId || undefined,
        hotel_id: actor.hotelId || undefined,
        role_id: actor.roleId || undefined,
        security: actor.userId ? {
          authenticated: actor.authenticated === true,
          identityConfidence: actor.identityConfidence || 'none',
          riskLevel: detail?.decision?.risk || 'UNKNOWN',
          hitlRequired: status === 'pending',
        } : undefined,
        result: detail?.result || (detail?.code ? { code: detail.code } : null),
        processed_at: ['accepted', 'executed', 'rejected', 'failed'].includes(status) ? new Date().toISOString() : null,
      }).eq('id', envelopeId)
      if (error) throw error
    },
    async audit({ envelopeId, hotelId, stage, decision, code, detail }) {
      const { error } = await admin.from('rand_gateway_audit').insert({
        envelope_id: envelopeId,
        hotel_id: hotelId || null,
        stage,
        decision,
        code,
        detail: detail || {},
      })
      if (error) throw error
    },
  })
}
