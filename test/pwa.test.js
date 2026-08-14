import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import test from 'node:test'

test('configurazione PWA completa e installabile', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

  assert.equal(manifest.name, 'Apicehotel Manutenzione')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.theme_color, '#0e5c49')
  assert(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'))
  assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'))

  for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
    assert((await stat(new URL(`../public/icons/${icon}`, import.meta.url))).size > 0)
  }

  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(serviceWorker, /self\.addEventListener\('install'/)
  assert.match(serviceWorker, /self\.addEventListener\('fetch'/)
  assert.match(serviceWorker, /request\.mode === 'navigate'/)
  assert.match(serviceWorker, /shellHtml\.matchAll/)
})
