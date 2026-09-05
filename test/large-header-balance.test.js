import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/randapp/adaptive-layout.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const foundation = fs.readFileSync(new URL('../src/randapp/randui/foundation.css', import.meta.url), 'utf8')

test('large mode keeps header chrome restrained in adaptive layout', () => {
  assert.match(css, /html\[data-ui-size='large'\] \.rs-hotelchip/)
  assert.match(css, /width: min\(68vw, 430px\)/)
  assert.match(css, /\.rs-presence-dot/)
  assert.match(css, /\.rs-header-notify \.rs-iconbtn/)
})

test('large header balance has one responsive owner through the final foundation', () => {
  assert.match(main, /\.\/randapp\/randui\/foundation\.css/)
  assert.match(foundation, /@import '\.\.\/adaptive-layout\.css'/)
  assert.doesNotMatch(main, /large-header-balance\.css/)
})
