import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Task/MyWork reads fetchIssues.issues and always clears loading', async () => {
  const view = await source('src/randapp/operations/MyWorkView.jsx')
  assert.match(view, /issuesRes\.issues\s*\|\|\s*issuesRes\.items/)
  assert.match(view, /finally\s*\{\s*setLoading\(false\)/)
})

test('login submit is wired on both form submit and ACCEDI click', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /busyRef/)
  assert.match(app, /onClick=\{\(e\) => \{ e\.preventDefault\(\); void submit\(e\) \}\}/)
  assert.match(app, /type="submit"/)
})

test('signed photo URLs fail soft on timeout instead of hanging Home/Task', async () => {
  const photos = await source('src/photo-storage.js')
  assert.match(photos, /signed-url-timeout/)
  assert.match(photos, /Promise\.race/)
  assert.match(photos, /2500/)
})
