import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

// Keep the Claude Material skin visually stable while consolidating the cascade.
test('Material sidebar search has exactly one light theme declaration', async () => {
  const css = await read('src/randapp/randui-material.css')
  const selector = "html:not([data-theme='dark']) .rnx-sidebar__search{"
  assert.equal(css.split(selector).length - 1, 1)
  assert.match(css, /html:not\(\[data-theme='dark'\]\) \.rnx-sidebar__search\{[^}]*color:var\(--rnx-text-3\)!important\}/)
})

test('Material theme contracts remain in place', async () => {
  const css = await read('src/randapp/randui-material.css')
  const auth = await read('src/randapp/randui-material-auth.css')
  assert.match(css, /html\[data-theme='dark'\] \.rnx-sidebar/)
  assert.match(css, /html:not\(\[data-theme='dark'\]\) \.rnx-sidebar/)
  assert.match(css, /@media\(max-width:767px\)/)
  assert.match(auth, /html\[data-theme='dark'\]/)
  assert.match(auth, /\.rs-themeswitch__thumb/)
})

test('CSS important budget does not increase', async () => {
  const css = await read('src/randapp/randui-material.css')
  const count = (css.match(/!important/g) || []).length
  assert.ok(count <= 135, `Material CSS !important grew to ${count}; review specificity before adding overrides`)
})
