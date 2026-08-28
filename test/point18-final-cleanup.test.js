import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

test('point 18 keeps package branding and dead dependencies removed from package and lockfile', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = read('package-lock.json')
  assert.equal(pkg.name, 'randapp-manutenzione')
  for (const dep of ['lucide-react', 'react-grid-layout', 'zod', 'zustand']) {
    assert.equal(pkg.dependencies?.[dep], undefined, `${dep} must stay removed`)
    assert.doesNotMatch(lock, new RegExp(`node_modules/${dep.replaceAll('/', '\\/')}`))
  }
})

test('point 18 removes obsolete Emergent and public preview artifacts', () => {
  assert.equal(fs.existsSync(path.join(root, '.emergent')), false)
  assert.equal(fs.existsSync(path.join(root, 'memory', 'PRD.md')), false)
  for (const file of [
    'public/av-video-test.html',
    'public/preview-login-lab.html',
    'public/preview-login.html',
    'public/preview-post-login.html',
    'public/preview-settings-dashboard.html',
  ]) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must stay removed`)
})

test('point 18 keeps application code free from the retired GitHub/Emergent bridge', () => {
  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'public'))]
    .filter((file) => /\.(js|jsx|mjs|html|css|json|webmanifest)$/i.test(file))
  const appText = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  assert.doesNotMatch(appText, /GITHUB_BRIDGE_SECRET/i)
  assert.doesNotMatch(appText, /\/api\/github\/test/i)
  assert.doesNotMatch(appText, /emergentintegrations/i)
})

test('point 18 documentation describes the consolidated app rather than obsolete demo/rebuild state', () => {
  const readme = read('README.md')
  const architecture = read('FRONTEND_ARCHITECTURE.md')
  assert.match(readme, /RandApp - Manutenzione/)
  assert.match(readme, /Quality Matrix/)
  assert.doesNotMatch(readme, /PIN demo/i)
  assert.doesNotMatch(readme, /53 migrazioni/i)
  assert.match(architecture, /stato consolidato/i)
  assert.match(architecture, /lucide-react.*react-grid-layout.*zod.*zustand/i)
  assert.doesNotMatch(architecture, /88\/99/)
  assert.doesNotMatch(architecture, /feature\/randapp-dark-shell-rebuild/)
})

test('point 18 environment template documents optional telemetry without secrets', () => {
  const env = read('.env.example')
  for (const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_SENTRY_ENABLED','VITE_SENTRY_DSN','VITE_OTEL_ENABLED','VITE_OTEL_EXPORTER_OTLP_ENDPOINT']) {
    assert.match(env, new RegExp(`^${key}=`, 'm'))
  }
  assert.doesNotMatch(env, /service_role|SUPABASE_SERVICE_ROLE_KEY/i)
})
