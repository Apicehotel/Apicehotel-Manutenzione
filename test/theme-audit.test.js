import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('final theme audit layer is loaded after reference/auth overrides', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /hotel-selector-reference\.css'[\s\S]*auth-theme-fix\.css'[\s\S]*theme-audit-fix\.css'/)
})

test('hotel selector has explicit light and dark theme surfaces', async () => {
  const css = await source('src/randapp/theme-audit-fix.css')
  assert.match(css, /html\[data-theme='light'\] \.rs-hotelselect__grid \.rs-hotel-option/)
  assert.match(css, /html\[data-theme='dark'\] \.rs-hotelselect__grid \.rs-hotel-option/)
  assert.match(css, /color: var\(--rs-text\)/)
})

test('legacy planning sale is rebound to theme tokens', async () => {
  const css = await source('src/randapp/theme-audit-fix.css')
  assert.match(css, /\.rs-legacy \.sale-form[\s\S]*var\(--rs-chrome-solid\)/)
  assert.match(css, /\.rs-legacy \.sale-form input,[\s\S]*var\(--rs-surface-2\)/)
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
