import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/diagnostics-client.js', import.meta.url), 'utf8')

test('diagnostic health timeout aborts underlying fetch instead of only racing it', () => {
  assert.match(source, /const controller = new AbortController\(\)/)
  assert.match(source, /controller\.abort\(new Error\('Timeout'\)\)/)
  assert.match(source, /await check\(controller\.signal\)/)
  assert.match(source, /async function supabaseHealth\(signal\)/)
  assert.match(source, /headers: \{ apikey: supabaseAnonKey \}, signal/)
  assert.doesNotMatch(source, /Promise\.race\(\[/)
})
