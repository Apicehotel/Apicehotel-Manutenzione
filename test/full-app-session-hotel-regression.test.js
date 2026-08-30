import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')

test('hotel session identity never falls back to first directory user or first hotel', () => {
  assert.doesNotMatch(source, /\|\|\s*rows\[0\]/)
  assert.doesNotMatch(source, /hotelById\(session\.hotelId\)\s*\|\|/)
  assert.match(source, /setDirectoryState\(matchedUser \? 'ready' : 'unauthorized'\)/)
  assert.match(source, /directoryState !== 'ready'/)
})
