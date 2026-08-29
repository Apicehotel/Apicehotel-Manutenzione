import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const shellCss = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')
const mobileAnchor = await readFile(new URL('../src/randapp/mobile-bottom-anchor.css', import.meta.url), 'utf8')

test('RandAI mirrors the global add FAB on mobile while keeping the cat mascot', () => {
  assert.match(assistant, /\/icons\/randai-cat\.webp/)
  assert.doesNotMatch(assistant, /<span>AI<\/span>/)
  assert.match(css, /\.randai\{[^}]*left:max\(18px,env\(safe-area-inset-left\)\)[^}]*right:auto/)
  assert.match(css, /\.randai__fab\{[^}]*width:var\(--rs-fab-h,58px\)[^}]*height:var\(--rs-fab-h,58px\)[^}]*border-radius:20px/)
  assert.match(css, /@media\(max-width:899px\)\{\.randai\{[^}]*bottom:calc\(58px \+ max\(6px,min\(env\(safe-area-inset-bottom,0px\),18px\)\) \+ 12px\)/)
  assert.match(shellCss, /\.rs-navfab\{[^}]*right:18px/)
  assert.match(shellCss, /width:var\(--rs-fab-h\);height:var\(--rs-fab-h\);border-radius:20px/)
  assert.match(mobileAnchor, /\.rs-navfab\s*\{[^}]*bottom:calc\(58px \+ max\(6px, min\(env\(safe-area-inset-bottom, 0px\), 18px\)\) \+ 12px\)/)
  assert.match(shell, /className="rs-navfab"/)
  assert.match(shell, /data-testid="fab-new"/)
})
