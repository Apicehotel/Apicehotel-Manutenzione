import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const helpers = await readFile(new URL('../src/randapp/helpers.js', import.meta.url), 'utf8')
const storage = await readFile(new URL('../src/photo-storage.js', import.meta.url), 'utf8')
const offline = await readFile(new URL('../src/offline-store.js', import.meta.url), 'utf8')
const issues = await readFile(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')

test('empty photos are rejected before storage upload', () => {
  assert.match(helpers, /!file\.size/)
  assert.match(storage, /blob\.size <= 0/)
  assert.match(offline, /blob\.size <= 0/)
})

test('issue photos use compact clickable previews with a fallback', () => {
  assert.match(issues, /function IssuePhoto/)
  assert.match(issues, /Foto non disponibile/)
  assert.match(issues, /rs-photo-lightbox/)
  assert.match(css, /width: min\(100%, 250px\)/)
  assert.match(css, /cursor: zoom-in/)
})
