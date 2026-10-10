import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('isImmutableAsset matches real Vite hashed bundle paths', () => {
  const sw = read('public/sw.js')
  const match = sw.match(/const isImmutableAsset = \(request\) => \{[\s\S]*?\n\}/)
  assert.ok(match, 'isImmutableAsset helper missing')
  const fn = vm.runInNewContext(`${match[0]}; isImmutableAsset`, { URL })
  const fake = (path) => ({ url: `https://apicehotel.vercel.app${path}` })
  assert.equal(fn(fake('/assets/index-AbCdEfGh.js')), true)
  assert.equal(fn(fake('/assets/index-Ab12_Cd34.css')), true)
  assert.equal(fn(fake('/assets/font-AbCdEfGh12.woff2')), true)
  assert.equal(fn(fake('/assets/index.js')), false)
  assert.equal(fn(fake('/sw.js')), false)
})

test('tech portal and admin-users store only hashed legacy technician tokens', () => {
  const portal = read('supabase/functions/tech-portal/index.ts')
  const admin = read('supabase/functions/admin-users/index.ts')
  const migration = read('supabase/migrations/20261010071000_hash_legacy_technician_access_tokens.sql')
  assert.match(portal, /eq\("token", `hash:\$\{digest\}`\)/)
  assert.doesNotMatch(portal, /\.eq\("token", value\)/)
  assert.match(admin, /const stored=`hash:\$\{digest\}`/)
  assert.match(admin, /regenerate_required:true/)
  assert.match(migration, /token not like 'hash:%'/)
  assert.match(migration, /token = 'revoked:' \|\| encode\(digest\(token, 'sha256'\), 'hex'\)/)
})

test('phone Material topbar shows short hotel labels', () => {
  const css = read('src/randapp/header-mobile.css')
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.rs-hotelchip__name-mobile[\s\S]*display:\s*inline/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.rs-hotelchip__name-desktop[\s\S]*display:\s*none/)
})
