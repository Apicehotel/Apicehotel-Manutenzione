import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('point 2 keeps a light-first theme with explicit dark/system choices', async () => {
  const theme = await source('src/randapp/theme.js')
  assert.match(theme, /return CHOICES\.includes\(saved\) \? saved : 'light'/)
  assert.match(theme, /THEMES = \[\['system', 'Sistema'\], \['light', 'Chiaro'\], \['dark', 'Scuro'\]\]/)
  assert.match(theme, /document\.documentElement\.dataset\.theme = resolved/)
})

test('hotel identity is a visual accent and does not replace semantic status colors', async () => {
  const [theme, css] = await Promise.all([
    source('src/randapp/theme.js'),
    source('src/randapp/ui-material-glass.css'),
  ])
  for (const hotel of ['hotelgio', 'chocohotel', 'brigantino']) assert.match(css, new RegExp(`data-hotel='${hotel}'`))
  assert.match(theme, /document\.documentElement\.dataset\.hotel = hotelId/)
  assert.match(css, /\.rs-badge--high/)
  assert.match(css, /var\(--rs-danger\)/)
  assert.match(css, /\.rs-badge--waiting/)
  assert.match(css, /var\(--rs-warn\)/)
  assert.match(css, /\.rs-badge--done/)
  assert.match(css, /var\(--rs-ok\)/)
})

test('liquid glass is restrained to app chrome and has accessibility fallbacks', async () => {
  const css = await source('src/randapp/ui-material-glass.css')
  assert.match(css, /\.rs-header,\n\.rs-bottomnav,\n\.rs-sheet,\n\.rs-navfab/)
  assert.doesNotMatch(css, /\.rs-card,\n\.rs-header,\n\.rs-bottomnav/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /prefers-contrast: more/)
  assert.match(css, /forced-colors: active/)
  assert.match(css, /@supports not \(\(backdrop-filter:/)
})

test('theme coherence loads the v2 visual layer after the base shell', async () => {
  const [main, coherence] = await Promise.all([
    source('src/main.jsx'),
    source('src/randapp/theme-coherence.css'),
  ])
  assert.match(main, /randapp\/shell\.css/)
  assert.match(main, /randapp\/theme-coherence\.css/)
  assert.match(coherence, /@import '\.\/ui-material-glass\.css';/)
})
