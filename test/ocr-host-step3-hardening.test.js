import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public-iss prefers opaque share tokens and rate-limits anonymous reads', () => {
  const edge = read('supabase/functions/public-iss/index.ts')
  const migration = read('supabase/migrations/20261010083400_issue_public_share_token.sql')
  const issuesUi = read('src/randapp/Issues.jsx')
  assert.match(migration, /public_share_token/)
  assert.match(migration, /ensure_issue_public_share_token/)
  assert.match(edge, /SHARE_TOKEN/)
  assert.match(edge, /public_share_token/)
  assert.match(edge, /allowPublicRead/)
  assert.match(edge, /RATE_LIMIT\s*=\s*30/)
  assert.match(issuesUi, /ensure_issue_public_share_token/)
  assert.match(issuesUi, /\/s\/\$\{shareId\}/)
})

test('send-push issue_created requires issues.create role permission', () => {
  const edge = read('supabase/functions/send-push/index.ts')
  assert.match(edge, /module", "issues"\)/)
  assert.match(edge, /action", "create"\)/)
  assert.match(edge, /!perm\?\.allowed\) return json\(\{ ok: false, error: "forbidden" \}, 403\)/)
})

test('Shell rejects off-origin bottom-nav href navigation', () => {
  const shell = read('src/randapp/Shell.jsx')
  assert.match(shell, /target\.origin !== window\.location\.origin/)
  assert.match(shell, /window\.location\.assign\(target\.href\)/)
})

test('inventory QR SVG is sanitized and QR edge requires auth', () => {
  const data = read('src/inventory-block2-data.js')
  const edge = read('supabase/functions/inventory-qr-label/index.ts')
  assert.match(data, /export function sanitizeQrSvg/)
  assert.match(data, /return sanitizeQrSvg\(data\?\.svg/)
  assert.match(edge, /auth\.getUser\(\)/)
  assert.match(edge, /unauthorized/)
})
