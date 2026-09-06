import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const preload = readFileSync(new URL('../src/offline-preload.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const supply = readFileSync(new URL('../src/supply-data.js', import.meta.url), 'utf8')
const context = readFileSync(new URL('../src/operational-context.js', import.meta.url), 'utf8')

test('offline preload is authenticated, permission-aware and bounded', () => {
  assert.match(preload, /fetchDirectory/)
  assert.match(preload, /canUser\(user, 'issues', 'view'\)/)
  assert.match(preload, /canUser\(user, 'supplies', 'view'\)/)
  assert.match(preload, /PRELOAD_TTL_MS = 10 \* 60 \* 1000/)
  assert.match(preload, /Promise\.allSettled/)
  assert.match(preload, /import\('\.\/issues-data\.js'\)/)
  assert.match(preload, /import\('\.\/planned-data\.js'\)/)
  assert.match(preload, /import\('\.\/sale-data\.js'\)/)
  assert.match(preload, /import\('\.\/urgents-data\.js'\)/)
  assert.match(main, /import\('\.\/offline-preload\.js'\)/)
})

test('supply reads and floor context fall back to the canonical IndexedDB cache', () => {
  assert.match(supply, /getCachedCollection/)
  assert.match(supply, /setCachedCollection/)
  assert.match(supply, /PRODUCTS_ENTITY = 'supply-products'/)
  assert.match(supply, /REQUESTS_ENTITY = 'supply-requests'/)
  assert.match(context, /CACHE_ENTITY = 'operational-floor-contexts'/)
  assert.match(context, /getCachedCollection/)
  assert.match(context, /setCachedCollection/)
})

test('non-idempotent supply writes stay explicitly online-only', () => {
  assert.match(supply, /L’invio della richiesta richiede una connessione internet/)
  assert.match(supply, /La gestione prodotti richiede una connessione internet/)
  assert.match(supply, /La conferma della consegna richiede una connessione internet/)
  assert.doesNotMatch(supply, /enqueueMutation/)
})
