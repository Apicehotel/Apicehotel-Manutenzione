import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('consolidated theme layers load after shared coherence styles', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /ui-coherence\.css'[\s\S]*login-reference\.css'[\s\S]*hotel-selector-reference\.css'[\s\S]*theme-coherence\.css'/)
  assert.doesNotMatch(main, /auth-theme-fix\.css|theme-audit-fix\.css/)
})

test('hotel selector owns explicit light and dark theme surfaces', async () => {
  const css = await source('src/randapp/hotel-selector-reference.css')
  assert.match(css, /html\[data-theme='light'\] \.rs-hotelselect__grid \.rs-hotel-option/)
  assert.match(css, /html\[data-theme='dark'\] \.rs-hotelselect__grid \.rs-hotel-option/)
  assert.match(css, /color: var\(--rs-text\)/)
})

test('planning uses the active v2 theme-token contract and legacy patch is not loaded', async () => {
  const [main, planning] = await Promise.all([
    source('src/main.jsx'),
    source('src/randapp/planning-sale-v2.css'),
  ])
  assert.match(main, /planning-sale-v2\.css/)
  assert.doesNotMatch(main, /planning-sale-fix\.css/)
  assert.match(planning, /var\(--rs-surface\)/)
  assert.match(planning, /var\(--rs-surface-2\)|var\(--rs-chrome-solid\)/)
})

test('global theme coherence owns native control color scheme', async () => {
  const css = await source('src/randapp/theme-coherence.css')
  assert.match(css, /html\[data-theme='light'\] \.rs-root select/)
  assert.match(css, /color-scheme: light/)
  assert.match(css, /html\[data-theme='dark'\] \.rs-root select/)
  assert.match(css, /color-scheme: dark/)
})

test('core housekeeping and planning modules use theme tokens', async () => {
  const [housekeeping, planning, insert] = await Promise.all([
    source('src/housekeeping-dark-theme.css'),
    source('src/randapp/planning-sale-v2.css'),
    source('src/randapp/insert-form.css'),
  ])
  assert.match(housekeeping, /var\(--rs-surface-2\)/)
  assert.match(planning, /background:var\(--rs-surface\)/)
  assert.match(insert, /background:var\(--rs-surface-2\)/)
})
