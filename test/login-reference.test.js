import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('approved login reference layer is loaded last and scoped only to the user login', async () => {
  const [main, css, app] = await Promise.all([
    source('src/main.jsx'),
    source('src/randapp/login-reference.css'),
    source('src/randapp/App.jsx'),
  ])
  assert.match(main, /ui-coherence\.css'[\s\S]*login-reference\.css'/)
  assert.match(css, /\.rs-auth:has\(\[data-testid='login-submit'\]\)/)
  assert.doesNotMatch(css, /admin-gate-submit/)
  assert.match(css, /\.rs-brand__logo img[\s\S]*width: 142%/)
  assert.match(css, /max-height: 760px/)
  assert.match(css, /min-width: 768px/)
  assert.match(app, /data-testid="login-submit"/)
  assert.match(app, /data-testid="admin-gate-submit"/)
})

test('login reference keeps authentication behavior unchanged', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /loginWithPin\(\{ hotelId, userId: user\.legacy_id \|\| user\.id, pin \}\)/)
  assert.match(app, /if \(pin\.length !== 4\)/)
  assert.match(app, /loadDirectoryAll\(\)/)
})
