import test from 'node:test'
import assert from 'node:assert/strict'
import { createIssueContextEnvelope, createRandAIContextEnvelope } from '../src/randai/context/envelope.js'
import { buildContextQuery, sanitizeOperationalContext } from '../supabase/functions/_shared/randai-operational-context.js'

test('context envelope is hotel-scoped and strips unsupported issue fields', () => {
  const envelope = createIssueContextEnvelope({
    hotelId: 'hotelgio',
    issue: {
      id: 'iss-1',
      room: 'Camera · 125',
      category: 'Climatizzazione',
      status: 'todo',
      urgency: 'alta',
      title: 'Non raffredda',
      secret: 'must-not-leak',
      photoData: 'data:image/jpeg;base64,xxx',
    },
  })
  assert.equal(envelope.version, 1)
  assert.equal(envelope.hotelId, 'hotelgio')
  assert.equal(envelope.resource.type, 'issue')
  assert.equal(envelope.resource.id, 'iss-1')
  assert.equal(envelope.resource.hasPhoto, true)
  assert.equal('secret' in envelope.resource, false)
  assert.equal('photoData' in envelope.resource, false)
})

test('base context remains useful without an active resource', () => {
  const envelope = createRandAIContextEnvelope({ hotelId: 'brigantino' })
  assert.equal(envelope.hotelId, 'brigantino')
  assert.equal(envelope.resource, null)
})

test('server rejects cross-hotel operational context', () => {
  assert.throws(
    () => sanitizeOperationalContext({ hotelId: 'chocohotel', resource: { type: 'issue', id: 'x' } }, 'hotelgio'),
    (error) => error?.code === 'CONTEXT_HOTEL_MISMATCH',
  )
})

test('verified issue context enriches vague follow-up queries', () => {
  const query = buildContextQuery('cosa controllo?', {
    type: 'issue',
    id: 'iss-1',
    location: 'Camera · 125',
    category: 'Climatizzazione',
    description: 'Non raffredda',
    status: 'todo',
  })
  assert.match(query, /Camera · 125/)
  assert.match(query, /Climatizzazione/)
  assert.match(query, /Non raffredda/)
  assert.match(query, /cosa controllo\?/)
})
