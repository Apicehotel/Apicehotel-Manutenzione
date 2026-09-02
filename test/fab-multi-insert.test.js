import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('floating plus uses contextual insert routing', async () => {
  const shell = await source('src/randapp/Shell.jsx')

  assert.match(shell, /className="rs-navfab"[\s\S]*onClick=\{openContextualAdd\}/)
  assert.match(shell, /aria-label=\{fabLabel \|\| 'Aggiungi'\}/)
  assert.match(shell, /const openContextualAdd = \(\) => \{[\s\S]*contextualActionIds\.length === 1[\s\S]*pickInsert\(contextualActionIds\[0\]\)[\s\S]*contextualActionIds\.length > 1[\s\S]*setInsertOpen\(true\)/)
  assert.match(shell, /<InsertLauncher[\s\S]*actionIds=\{contextualActionIds\}/)
  assert.doesNotMatch(shell, /if \(insertAllowed\.issue\) \{ pickInsert\('issue'\)/)
})
