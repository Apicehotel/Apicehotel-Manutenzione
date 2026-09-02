import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('floating plus uses the contextual multi-insert router', async () => {
  const shell = await source('src/randapp/Shell.jsx')

  assert.match(shell, /className="rs-navfab"[\s\S]*onClick=\{openContextualAdd\}/)
  assert.match(shell, /aria-label=\{fabLabel \|\| 'Aggiungi'\}/)
  assert.match(shell, /<InsertLauncher[\s\S]*actionIds=\{contextualActionIds\}/)

  assert.match(shell, /if \(contextualActionIds\.length === 1\) \{ pickInsert\(contextualActionIds\[0\]\); return \}/)
  assert.match(shell, /if \(contextualActionIds\.length > 1\) setInsertOpen\(true\)/)

  assert.doesNotMatch(shell, /allowedActions=\{insertAllowed\}/)
  assert.doesNotMatch(shell, /if \(insertAllowed\.issue\) \{ pickInsert\('issue'\)/)
})
