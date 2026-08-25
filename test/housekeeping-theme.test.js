import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Housekeeping follows RandApp native light/dark tokens without overriding core theme', async () => {
  const [bridge, shell, theme] = await Promise.all([
    read('../src/housekeeping-dark-theme.css'),
    read('../src/randapp/shell.css'),
    read('../src/randapp/theme.js'),
  ])

  assert.match(shell, /html\[data-theme='light'\]/)
  assert.match(theme, /document\.documentElement\.dataset\.theme = resolved/)
  assert.match(bridge, /--hk-card:var\(--rs-surface-2\)/)
  assert.match(bridge, /--rs-card:var\(--hk-card\)/)
  assert.match(bridge, /html\[data-theme='light'\]/)
  assert.match(bridge, /html\[data-theme='dark'\]/)

  // Il bridge può creare alias mancanti, ma non deve ridefinire i token core
  // che shell.css commuta tra Light e Dark.
  assert.doesNotMatch(bridge, /(^|[;{]\s*)--rs-text\s*:/m)
  assert.doesNotMatch(bridge, /(^|[;{]\s*)--rs-surface\s*:/m)
  assert.doesNotMatch(bridge, /(^|[;{]\s*)--rs-line\s*:/m)
})
