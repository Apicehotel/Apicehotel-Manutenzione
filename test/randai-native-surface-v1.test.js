import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/randai/randai.css', import.meta.url), 'utf8')

test('RandAI quick surface uses RandUI tokens and safe viewport geometry', () => {
  assert.match(css, /var\(--rs-card/)
  assert.match(css, /var\(--rs-text/)
  assert.match(css, /var\(--rs-accent/)
  assert.match(css, /env\(safe-area-inset-top/)
  assert.match(css, /env\(safe-area-inset-bottom/)
  assert.match(css, /100dvh/)
  assert.doesNotMatch(css, /width:\s*100vw/)
})

test('RandAI messages and composer remain scroll and keyboard safe', () => {
  assert.match(css, /\.randai__messages[\s\S]*min-height:\s*0/)
  assert.match(css, /overscroll-behavior:\s*contain/)
  assert.match(css, /\.randai__composer[\s\S]*flex:\s*0 0 auto/)
  assert.match(css, /\.randai--page \.randai__messages[\s\S]*flex:\s*1 1 auto/)
  assert.match(css, /@media \(max-height: 560px\)/)
})

test('RandAI native surface has explicit accessibility fallbacks', () => {
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /forced-colors:\s*active/)
  assert.match(css, /min-height:\s*44px/)
})
