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


test('login keyboard focus must not move the submit button on mobile', async () => {
  const css = await source('src/randapp/login-reference.css')
  assert.doesNotMatch(css, /:has\(input:focus\)[\s\S]{0,220}\.rs-auth__inner/)
  assert.doesNotMatch(css, /:has\(input:focus\)[\s\S]{0,220}\.rs-authcard/)
  assert.doesNotMatch(css, /:has\(input:focus\)[\s\S]{0,220}\[data-testid='login-submit'\]/)
})
