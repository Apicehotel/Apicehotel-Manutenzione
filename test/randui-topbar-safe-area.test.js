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
  assert.match(css, /@media\(max-width:767px\)\{[\s\S]*\.rnx-topbar\{[\s\S]*padding:\s*calc\(7px \+ var\(--rnx-safe-top\)\)/)
  // Phone media must not wipe the safe-top with a plain padding shorthand.
  assert.doesNotMatch(css, /@media\(max-width:767px\)\{[\s\S]*\.rnx-topbar\{padding:\s*\d+px\s+\d+px/)
})
