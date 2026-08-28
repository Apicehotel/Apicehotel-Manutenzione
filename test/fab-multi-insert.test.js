import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('floating plus opens the multi-insert launcher', async () => {
  const shell = await source('src/randapp/Shell.jsx')
  assert.match(shell, /className="rs-navfab"[\s\S]*onClick=\{\(\) => setInsertOpen\(true\)\}/)
  assert.match(shell, /aria-label="Nuovo inserimento"/)
  assert.match(shell, /<InsertLauncher[\s\S]*allowedActions=\{insertAllowed\}/)
  assert.doesNotMatch(shell, /if \(insertAllowed\.issue\) \{ pickInsert\('issue'\)/)
})
