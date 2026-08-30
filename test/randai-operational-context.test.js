import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOperationalContext,
  clearOperationalContext,
  contextQueryHint,
  getOperationalContext,
  publishOperationalContext,
} from '../src/randai/context/operational-context.js'

test('operational context is hotel scoped and strips untrusted fields', () => {
  const envelope = buildOperationalContext({
    hotelId: 'hotelgio',
    view: 'issues',
    source: 'issue-detail',
    resource: {
      type: 'maintenance_issue',
      id: 'abc-123',
      location: 'Camera 125',
      category: 'Climatizzazione',
      status: 'todo',
      summary: 'Non raffredda',
      secret: 'must-not-pass',
    },
    random: 'ignored',
  })

  assert.equal(envelope.hotelId, 'hotelgio')
  assert.equal(envelope.resource.id, 'abc-123')
  assert.equal(envelope.resource.secret, undefined)
  assert.equal(envelope.random, undefined)
  assert.match(contextQueryHint(envelope), /Camera 125/)
})

test('active operational context cannot leak across hotels', () => {
  publishOperationalContext({ hotelId: 'hotelgio', view: 'issues', resource: { type: 'maintenance_issue', id: 'i-1' }, queryHint: 'Camera 125 non fredda' })
  assert.equal(getOperationalContext({ hotelId: 'hotelgio' })?.resource?.id, 'i-1')
  assert.equal(getOperationalContext({ hotelId: 'brigantino' }), null)
  assert.equal(clearOperationalContext({ hotelId: 'brigantino' }), false)
  assert.equal(getOperationalContext({ hotelId: 'hotelgio' })?.resource?.id, 'i-1')
  assert.equal(clearOperationalContext({ hotelId: 'hotelgio', resourceType: 'maintenance_issue', resourceId: 'i-1' }), true)
  assert.equal(getOperationalContext({ hotelId: 'hotelgio' }), null)
})

test('invalid identifiers are rejected instead of normalized into a scope', () => {
  assert.equal(buildOperationalContext({ hotelId: '../other-hotel' }), null)
  const envelope = buildOperationalContext({ hotelId: 'hotelgio', resource: { type: 'maintenance issue', id: 'bad id' } })
  assert.equal(envelope.resource, null)
})
