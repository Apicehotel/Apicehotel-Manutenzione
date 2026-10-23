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

test('Material cascade prevents duplicate sidebar search selectors and global overrides', async () => {
  const css = await read('src/randapp/randui-material.css')
  const selector = "html:not([data-theme='dark']) .rnx-sidebar__search{"
  assert.equal(css.split(selector).length - 1, 1)
  // Scoped mobile overrides may grow; guard the failure mode, not a magic !important count.
  const marker = '/* Mobile Home: card headers remain inside'
  const start = css.indexOf(marker)
  assert.ok(start >= 0, 'Mobile Home fix must remain present')
  const mobile = css.slice(start)
  assert.match(mobile, /@media\s*\(max-width:\s*767px\)/)
  assert.match(mobile, /\.rnx-home \.rnx-kpi-grid/)
  assert.doesNotMatch(mobile, /(?:^|\n)\s*html\s*\{|(?:^|\n)\s*body\s*\{/)
})
