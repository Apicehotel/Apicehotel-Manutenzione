import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLoginUser } from '../src/randapp/login-resolve.js'

const directory = [
  { id: '1', name: 'Randagio', hotels: ['hotelgio'] },
  { id: '2', name: 'Reception Gio', hotels: ['hotelgio'] },
  { id: '3', name: 'Receptio Choco', hotels: ['chocohotel'] },
]

test('resolveLoginUser accepts an explicit matched user', () => {
  assert.equal(resolveLoginUser(directory, 'x', directory[0]), directory[0])
})

test('resolveLoginUser matches an exact typed name without list click', () => {
  assert.equal(resolveLoginUser(directory, 'Randagio', null)?.id, '1')
  assert.equal(resolveLoginUser(directory, '  randagio  ', null)?.id, '1')
})

test('resolveLoginUser accepts a unique prefix on submit', () => {
  assert.equal(resolveLoginUser(directory, 'Randa', null)?.id, '1')
})

test('resolveLoginUser refuses ambiguous prefixes', () => {
  assert.equal(resolveLoginUser(directory, 'Recept', null), null)
})

test('resolveLoginUser returns null for empty query or empty directory', () => {
  assert.equal(resolveLoginUser(directory, '', null), null)
  assert.equal(resolveLoginUser([], 'Randagio', null), null)
})
