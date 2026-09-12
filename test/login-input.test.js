import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLoginNick, resolveLoginUser, sanitizeLoginPin } from '../src/randapp/login-input.js'

test('risolve un nick incollato anche con spazi e maiuscole diverse', () => {
  const user = { id: 'u-1', name: 'Randagio Rossi' }
  assert.equal(resolveLoginUser('  rAndAgio   Rossi  ', [user]), user)
  assert.equal(resolveLoginUser('Randagio', [user]), null)
})

test('normalizza caratteri Unicode compatibili senza perdere il nome visualizzato', () => {
  assert.equal(normalizeLoginNick('  RANDAGIO\u00a0 Rossi  '), 'randagio rossi')
  const user = { id: 'u-2', name: 'Hotel １２' }
  assert.equal(resolveLoginUser('hotel 12', [user]), user)
})

test('accetta PIN incollati, rimuove caratteri non numerici e limita le cifre', () => {
  assert.equal(sanitizeLoginPin('12a34-56'), '1234')
  assert.equal(sanitizeLoginPin('１２３４５'), '1234')
  assert.equal(sanitizeLoginPin('123', 6), '123')
})
