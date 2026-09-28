import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const client = fs.readFileSync(new URL('../src/randapp/query-client.js', import.meta.url), 'utf8')

test('TanStack Query is wired once at the RandApp root', () => {
  assert.match(main, /QueryClientProvider/)
  assert.match(main, /client=\{queryClient\}/)
  assert.match(main, /\.\/randapp\/query-client\.js/)
})

test('server-state policy avoids duplicate offline ownership', () => {
  assert.match(client, /new QueryClient/)
  assert.match(client, /refetchOnReconnect: true/)
  assert.match(client, /refetchOnWindowFocus: false/)
  assert.match(client, /mutations:[\s\S]*retry: false/)
  // Guard executable persistence hooks/imports, not explanatory comments.
  assert.doesNotMatch(client, /persistQueryClient/)
  assert.doesNotMatch(client, /from ['"]dexie['"]|require\(['"]dexie['"]\)/i)
  assert.doesNotMatch(client, /\b(?:window\.)?localStorage\s*[.[]/)
  assert.doesNotMatch(client, /\bindexedDB\s*[.[]/)
})
