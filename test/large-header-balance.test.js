import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/randapp/large-header-balance.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('large mode keeps header chrome restrained', () => {
  assert.match(css, /html\[data-ui-size='large'\] \.rs-hotelchip/)
  assert.match(css, /width: min\(68vw, 430px\)/)
  assert.match(css, /\.rs-presence-dot/)
  assert.match(css, /\.rs-header-notify \.rs-iconbtn/)
})

test('large header balance loads after presence styling', () => {
  assert.ok(main.indexOf("./randapp/large-header-balance.css") > main.indexOf("./randapp/presence-dot.css"))
})
