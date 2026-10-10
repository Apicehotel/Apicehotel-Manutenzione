import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandUI Next topbar owns the iOS notch safe-area (no double padding on shell)', async () => {
  const css = await read('src/randapp/randui-next.css')
  assert.match(css, /--rnx-safe-top:\s*var\(--rs-adaptive-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)/)
  assert.match(css, /--rnx-topbar-row:\s*calc\(var\(--rnx-topbar\) \+ var\(--rnx-safe-top\)\)/)
  assert.match(css, /\.rnx-app\{[\s\S]*grid-template-rows:\s*var\(--rnx-topbar-row\)/)
  assert.match(css, /\.rnx-app\{[\s\S]*padding-top:\s*0/)
  assert.match(css, /\.rnx-topbar\{[\s\S]*min-height:\s*var\(--rnx-topbar-row\)/)
  assert.match(css, /\.rnx-topbar\{[\s\S]*padding:\s*calc\(9px \+ var\(--rnx-safe-top\)\)/)
  assert.match(css, /@media\(max-width:767px\)\{[\s\S]*\.rnx-topbar\{[\s\S]*padding:\s*calc\(12px \+ var\(--rnx-safe-top\)\)/)
  assert.match(css, /@media\(max-width:767px\)\{[\s\S]*\.rnx-bottomnav\{[\s\S]*padding:\s*4px[\s\S]*calc\(2px \+ env\(safe-area-inset-bottom\)\)/)
  // Phone media must not wipe the safe-top with a plain padding shorthand.
  assert.doesNotMatch(css, /@media\(max-width:767px\)\{[\s\S]*\.rnx-topbar\{padding:\s*\d+px\s+\d+px/)
})

test('RandUI Next pins the topbar on phone/tablet; only the stage scrolls', async () => {
  const css = await read('src/randapp/randui-next.css')
  assert.match(css, /@media\s*\(max-width:\s*1199px\)\s*\{[\s\S]*\.rnx-app\{[\s\S]*height:\s*var\(--rs-app-viewport-height/)
  assert.match(css, /@media\s*\(max-width:\s*1199px\)\s*\{[\s\S]*\.rnx-app\{[\s\S]*overflow:\s*hidden/)
  assert.match(css, /@media\s*\(max-width:\s*1199px\)\s*\{[\s\S]*\.rnx-topbar\{[\s\S]*position:\s*relative/)
  assert.match(css, /@media\s*\(max-width:\s*1199px\)\s*\{[\s\S]*\.rnx-stage\{[\s\S]*overflow-y:\s*auto/)
  assert.match(css, /@media\s*\(max-width:\s*1199px\)\s*\{[\s\S]*\.rnx-stage\{[\s\S]*-webkit-overflow-scrolling:\s*touch/)
})
