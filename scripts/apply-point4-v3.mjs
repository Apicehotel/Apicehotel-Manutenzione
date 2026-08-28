await import('./apply-point4-v2.mjs')
import { readFile, writeFile } from 'node:fs/promises'

let app = await readFile('src/randapp/App.jsx', 'utf8')
app = app.replace("import { fetchDirectory } from '../users-data.js'\n", '')
app = app.replace("import { loginWithPin, loginAdmin } from '../auth-data.js'\n", '')
app = app.replace("import { signOutSupabase } from '../auth-data.js'\n", '')
app = app.replace("async function loadDirectoryAll() {\n  const rows = await Promise.all", "async function loadDirectoryAll() {\n  const { fetchDirectory } = await import('../users-data.js')\n  const rows = await Promise.all")
app = app.replace("try { await loginAdmin(pin); setOk(true) }", "try { const { loginAdmin } = await import('../auth-data.js'); await loginAdmin(pin); setOk(true) }")
app = app.replace("const auth = await loginWithPin({ hotelId, userId: user.legacy_id || user.id, pin })", "const { loginWithPin } = await import('../auth-data.js')\n        const auth = await loginWithPin({ hotelId, userId: user.legacy_id || user.id, pin })")
app = app.replace("  const onLogout = async () => {\n    await signOutSupabase()", "  const onLogout = async () => {\n    const { signOutSupabase } = await import('../auth-data.js')\n    await signOutSupabase()")
await writeFile('src/randapp/App.jsx', app)

let budget = await readFile('scripts/check-bundle.mjs', 'utf8')
budget = budget.replace('const limit = 450 * 1024', 'const limit = 350 * 1024')
await writeFile('scripts/check-bundle.mjs', budget)

let tests = await readFile('test/performance-architecture.test.js', 'utf8')
tests += `\ntest('Supabase-backed auth and directory are deferred from the entry module', async () => {\n  const app = await source('src/randapp/App.jsx')\n  assert.doesNotMatch(app, /^import .*users-data\\.js/m)\n  assert.doesNotMatch(app, /^import .*auth-data\\.js/m)\n  assert.match(app, /await import\\('\.\.\\/users-data\\.js'\\)/)\n  assert.match(app, /await import\\('\.\.\\/auth-data\\.js'\\)/)\n})\n`
await writeFile('test/performance-architecture.test.js', tests)
