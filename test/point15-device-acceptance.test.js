import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const manifest = fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')
const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const device = fs.readFileSync(new URL('./device-acceptance.mjs', import.meta.url), 'utf8')
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const pkg = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
const issues = fs.readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
const checklist = fs.readFileSync(new URL('../docs/DEVICE_ACCEPTANCE.md', import.meta.url), 'utf8')

test('point 15 PWA identity and cache-busting stay aligned', () => {
  assert.match(manifest, /"name": "RandApp - Manutenzione"/)
  assert.match(manifest, /"display": "standalone"/)
  assert.match(manifest, /icon-192\.png\?v=9/)
  assert.match(manifest, /icon-512\.png\?v=9/)
  assert.match(manifest, /icon-maskable-512\.png\?v=9/)
  assert.match(sw, /icon-192\.png\?v=9/)
  assert.match(sw, /icon-512\.png\?v=9/)
})

test('point 15 device gate covers iOS Android and Windows-like environments', () => {
  assert.match(device, /iPhone 13/)
  assert.match(device, /Pixel 7/)
  assert.match(device, /Windows NT 10\.0/)
  assert.match(device, /webkit/)
  assert.match(device, /chromium/)
})

test('point 15 exercises PWA offline reload keyboard viewport orientation and touch targets', () => {
  assert.match(device, /navigator\.serviceWorker\.ready/)
  assert.match(device, /context\.setOffline\(true\)/)
  assert.match(device, /page\.reload/)
  assert.match(device, /pin\.focus\(\)/)
  assert.match(device, /setViewportSize/)
  assert.match(device, /landscape/)
  assert.match(device, />= 44/)
})

test('point 15 keeps mobile photo picker compatible with camera or library', () => {
  assert.match(issues, /type="file" accept="image\/\*"/)
  assert.doesNotMatch(issues, /capture="environment"/)
  assert.match(issues, /compressPhotoAsDataUrl/)
})

test('point 15 gate is mandatory in CI and documented for physical-only checks', () => {
  assert.match(pkg, /"test:device": "node test\/device-acceptance\.mjs"/)
  assert.match(ci, /Device acceptance gate/)
  assert.match(ci, /npm run test:device/)
  assert.match(checklist, /iPhone — Safari \+ PWA installata/)
  assert.match(checklist, /Android — Chrome \+ PWA installata/)
  assert.match(checklist, /Windows — Edge \+ Chrome/)
  assert.match(checklist, /fotocamera\/libreria/)
  assert.match(checklist, /notifica push\/ntfy/)
})
