import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Task/MyWork uses lean hub fetches and always clears list loading', async () => {
  const view = await source('src/randapp/operations/MyWorkView.jsx')
  assert.match(view, /fetchIssuesForHub/)
  assert.match(view, /fetchPlannedForHub/)
  assert.match(view, /setIssues\(issuesRes\.issues\s*\|\|\s*\[\]\)/)
  assert.match(view, /finally\s*\{\s*setListLoading\(false\)/)
  assert.doesNotMatch(view, /fetchIssues\(/)
  assert.doesNotMatch(view, /fetchPlanned\(/)
  assert.doesNotMatch(view, /task-toggle-my-work/)
  assert.doesNotMatch(view, /subscribeIssues/)
})

test('login submit uses one native form submit path for first-tap mobile reliability', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /busyRef/)
  assert.doesNotMatch(app, /onClick=\{\(e\) => \{ e\.preventDefault\(\); void submit\(e\) \}\}/)
  assert.match(app, /type="submit"/)
})

test('signed photo URLs fail soft on timeout instead of hanging Home/Task', async () => {
  const photos = await source('src/photo-storage.js')
  assert.match(photos, /signed-url-timeout/)
  assert.match(photos, /Promise\.race/)
  assert.match(photos, /2500/)
})


test('login auto-submits on the fourth PIN digit and keeps ACCEDI as fallback', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /const nextPin = e\.target\.value\.replace/)
  assert.match(app, /if \(nextPin\.length === 4 && !busyRef\.current\)/)
  assert.match(app, /void submit\(null, nextPin\)/)
  assert.match(app, /enterKeyHint="go"/)
  assert.match(app, /type="submit"/)
})

test('mobile login focus does not resize the form around the submit button', async () => {
  const css = await source('src/randapp/login-reference.css')
  const mobileFocusBlock = css.match(/@media \(max-width: 600px\) \{[\s\S]*?\.rs-auth:has\(input:focus\) \.rs-suggest \{[\s\S]*?\n  \}\n\}/)?.[0] || ''
  assert.match(mobileFocusBlock, /\.rs-auth:has\(input:focus\) \.rs-suggest/)
  assert.doesNotMatch(mobileFocusBlock, /\.rs-auth__inner/)
  assert.doesNotMatch(mobileFocusBlock, /\.rs-authcard/)
  assert.doesNotMatch(mobileFocusBlock, /login-submit/)
})
