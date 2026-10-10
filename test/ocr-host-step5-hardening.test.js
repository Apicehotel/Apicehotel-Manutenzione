import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('unauthenticated PIN login directory is query-gated (no full dump)', () => {
  const pinAuth = read('supabase/functions/pin-auth/index.ts')
  const usersData = read('src/users-data.js')
  const app = read('src/randapp/App.jsx')
  assert.match(pinAuth, /LOGIN_DIRECTORY_MIN_QUERY\s*=\s*2/)
  assert.match(pinAuth, /LOGIN_DIRECTORY_MAX_RESULTS\s*=\s*12/)
  assert.match(pinAuth, /async function listLoginDirectory\(hotelId:string,query:string\)/)
  assert.match(pinAuth, /normalizeLoginQuery\(u\.nome\)\.startsWith\(q\)/)
  assert.match(pinAuth, /shuffleInPlace\(matched\)\.slice\(0,LOGIN_DIRECTORY_MAX_RESULTS\)/)
  assert.match(pinAuth, /query_required:\s*true/)
  assert.match(usersData, /export async function fetchLoginDirectory\(hotelId, query = ''\)/)
  assert.match(usersData, /LOGIN_DIRECTORY_MIN_QUERY/)
  assert.match(app, /searchLoginDirectory/)
  assert.match(app, /LOGIN_DIRECTORY_MIN_QUERY/)
  assert.doesNotMatch(app, /loadDirectoryAll\(/)
})

test('OTEL stays fail-closed unless endpoint is CSP-safe', () => {
  const telemetry = read('src/external-telemetry.js')
  const envExample = read('.env.example')
  assert.match(telemetry, /export function isOtelEndpointCspSafe/)
  assert.match(telemetry, /VITE_OTEL_CONNECT_ORIGINS/)
  assert.match(telemetry, /enabled: enabled\('VITE_OTEL_ENABLED'\) && otelCspSafe/)
  assert.match(telemetry, /endpoint fuori da connect-src CSP/)
  assert.match(envExample, /VITE_OTEL_CONNECT_ORIGINS=/)
  assert.match(envExample, /vercel\.json \+ ocean\/nginx\.conf/)
})

test('service worker install MIME-checks dynamic assets and bumps cache to v26', () => {
  const sw = read('public/sw.js')
  assert.match(sw, /CACHE_NAME = 'apicehotel-manutenzione-v26'/)
  assert.match(sw, /const precacheAsset = async/)
  assert.match(sw, /isValidDynamicAsset\(\{ destination \}, response\)/)
  assert.doesNotMatch(sw, /cache\.addAll\(/)
})

test('ntfy client reuses the shared supabase anon key export', () => {
  const client = read('src/randapp/ntfy/ntfy-client.js')
  assert.match(client, /supabaseAnonKey/)
  assert.doesNotMatch(client, /sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX/)
})
