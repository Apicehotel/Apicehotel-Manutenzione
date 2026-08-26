import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')

test('issues toolbar remains in normal document flow', () => {
  const start = css.indexOf('.rs-toolbar {')
  const end = css.indexOf('\n}', start)
  assert.ok(start >= 0 && end > start, 'Missing .rs-toolbar rule')
  const rule = css.slice(start, end + 2)
  assert.match(rule, /position:\s*static/)
  assert.doesNotMatch(rule, /position:\s*sticky/)
})

test('global content owns FAB/nav safe spacing and issues never compensate with overlap', () => {
  assert.match(css, /--rs-content-bottom-clearance:\s*calc\([^;]*var\(--rs-nav-h\)[^;]*var\(--rs-safe-bottom\)[^;]*var\(--rs-fab-h\)/)
  assert.match(css, /\.rs-content\s*\{[\s\S]*?padding:[^;]*var\(--rs-content-bottom-clearance\)/)
  assert.doesNotMatch(css, /\[data-testid=['"]issues-list['"]\][\s\S]{0,180}margin-top:\s*-/)
})

test('mobile issue filters use adaptive grid without horizontal scrolling', () => {
  const marker = css.indexOf('/* issue filters responsive */')
  assert.ok(marker >= 0, 'Missing issue filter responsive block')
  const block = css.slice(marker)
  assert.match(block, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(block, /nth-child\(-n\+3\)[\s\S]*?grid-column:\s*span 2/)
  assert.match(block, /nth-child\(4\)[\s\S]*?grid-column:\s*span 3/)
  assert.doesNotMatch(block.slice(0, block.indexOf('@media (min-width: 721px)')), /overflow-x:\s*auto/)
})
