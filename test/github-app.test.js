import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import test from 'node:test'
import { createAppJwt, isAuthorized } from '../api/_lib/github-app.js'

test('creates a verifiable RS256 GitHub App JWT', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwt = createAppJwt({ appId: '1234', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), now: 1_700_000_000 })
  const [header, payload, signature] = jwt.split('.')
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256')
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iat: 1_699_999_940, exp: 1_700_000_540, iss: '1234' })
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')), true)
})

test('bridge authorization rejects missing and incorrect secrets', () => {
  assert.equal(isAuthorized({ headers: {} }, 'secret'), false)
  assert.equal(isAuthorized({ headers: { authorization: 'Bearer wrong' } }, 'secret'), false)
  assert.equal(isAuthorized({ headers: { authorization: 'Bearer secret' } }, 'secret'), true)
})

