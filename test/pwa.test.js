import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import test from 'node:test'

test('configurazione PWA completa e installabile', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

  assert.equal(manifest.name, 'RandApp - Manutenzione')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.theme_color, '#0e5c49')
  assert(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'))
  assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'))
  assert(manifest.icons.every((icon) => String(icon.src).includes('v=9')))

  for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
    assert((await stat(new URL(`../public/icons/${icon}`, import.meta.url))).size > 0)
  }

  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(serviceWorker, /self\.addEventListener\('install'/)
  assert.match(serviceWorker, /self\.addEventListener\('fetch'/)
  assert.match(serviceWorker, /request\.mode === 'navigate'/)
  assert.match(serviceWorker, /shellHtml\.matchAll/)
  assert.match(serviceWorker, /apicehotel-manutenzione-v22/)
  assert.match(serviceWorker, /keys\.filter\(\(key\) => key !== CACHE_NAME/)
})


test('PWA registration forces waiting worker activation after UI deploys', async () => {
  const pwa = await readFile(new URL('../src/pwa.js', import.meta.url), 'utf8')
  assert.match(pwa, /updateViaCache: 'none'/)
  assert.match(pwa, /registration\.update\(\)/)
  assert.match(pwa, /registration\.waiting.*SKIP_WAITING/)
})
