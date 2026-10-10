import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const pwa = readFileSync(new URL('../src/pwa.js', import.meta.url), 'utf8')
const e2e = readFileSync(new URL('../test/e2e.mjs', import.meta.url), 'utf8')
const ocean = readFileSync(new URL('../.github/workflows/digitalocean-preview.yml', import.meta.url), 'utf8')

test('SPA rewrite excludes immutable/static asset namespaces', () => {
  assert.ok(vercel.includes('(?!assets/'))
  assert.ok(vercel.includes('icons/'))
  assert.ok(vercel.includes('logos/'))
  assert.ok(vercel.includes('manifest\\\\.webmanifest'))
  assert.ok(vercel.includes('sw\\\\.js'))
})

test('service worker validates MIME before caching dynamic assets', () => {
  assert.match(sw, /isValidDynamicAsset/) 
  assert.match(sw, /isImmutableAsset/)
  assert.match(sw, /content-type/)
  assert.match(sw, /javascript/)
  assert.match(sw, /text\/css/)
  assert.match(sw, /CACHE_NAME = 'apicehotel-manutenzione-v25'/)
  assert.match(sw, /navigator\.onLine !== false/)
  assert.match(sw, /status:\s*504/)
  assert.match(sw, /PURGE_RUNTIME_CACHES/)
  assert.match(sw, /Deployment asset no longer available/)
  assert.match(sw, /status:\s*503/)
  // Hashed Vite assets must match (single-escaped \. in the regex literal).
  assert.match(sw, /\/-\[a-z0-9_-\]\{8,\}\\\.\(\?:js\|css\|woff2\?\)\$\/i/)
  assert.match(sw, /safeNotificationUrl/)
  assert.match(sw, /url\.origin !== self\.location\.origin/)
})

test('Vercel Git deploys stay paused; Ocean stable preview is owned by main', () => {
  const config = JSON.parse(vercel)
  assert.equal(config.git?.deploymentEnabled, false)
})

test('Ocean preview waits for javascript SW before browser gates', () => {
  assert.match(ocean, /Wait for Ocean preview service worker/)
  assert.match(ocean, /sw\.js/)
  assert.match(ocean, /javascript|ecmascript/)
  assert.match(pwa, /console\.warn\('Registrazione PWA non riuscita'/)
  assert.doesNotMatch(pwa, /console\.error\('Registrazione PWA non riuscita'/)
  assert.match(e2e, /Registrazione PWA non riuscita/)
  assert.match(e2e, /Failed to update a ServiceWorker/)
})

test('CSP blocks default script injection and keeps app connect targets', () => {
  const config = JSON.parse(vercel)
  const csp = config.headers
    ?.flatMap((entry) => entry.headers || [])
    ?.find((header) => header.key === 'Content-Security-Policy')
    ?.value || ''
  assert.match(csp, /default-src 'self'/)
  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.supabase\.co/)
  assert.match(csp, /connect-src[^;]*wss:\/\/\*\.supabase\.co/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/)
})

test('Ocean nginx returns real 404 for missing hashed assets (no SPA catchall)', () => {
  const app = readFileSync(new URL('../.do/app.yaml', import.meta.url), 'utf8')
  const nginx = readFileSync(new URL('../ocean/nginx.conf', import.meta.url), 'utf8')
  const dockerfile = readFileSync(new URL('../Dockerfile.ocean', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /catchall_document:\s*index\.html/)
  assert.match(app, /dockerfile_path:\s*Dockerfile\.ocean/)
  assert.match(app, /http_port:\s*8080/)
  assert.match(dockerfile, /FROM nginx:1\.27-alpine/)
  assert.match(dockerfile, /ocean\/nginx\.conf/)
  assert.match(dockerfile, /EXPOSE 8080/)
  assert.match(nginx, /location \^~ \/assets\/[\s\S]*try_files \$uri =404/)
  assert.match(nginx, /location \/ \{[\s\S]*try_files \$uri \$uri\/ \/index\.html/)
  assert.match(nginx, /Content-Security-Policy/)
})
