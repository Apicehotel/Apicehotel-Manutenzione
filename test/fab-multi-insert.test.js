import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('global floating add button stays removed while contextual insert routes remain available', async () => {
  const shell = await source('src/randapp/Shell.jsx')

  assert.doesNotMatch(shell, /className="rs-navfab"/)
  assert.doesNotMatch(shell, /data-testid="fab-new"/)
  assert.match(shell, /<InsertLauncher[\s\S]*actionIds=\{contextualActionIds\}/)
  assert.doesNotMatch(shell, /allowedActions=\{insertAllowed\}/)
})
