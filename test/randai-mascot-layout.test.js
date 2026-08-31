import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const shellCss = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')
const adaptiveCss = await readFile(new URL('../src/randapp/adaptive-layout.css', import.meta.url), 'utf8')

const compact = (value) => value.replace(/\s+/g, '')

test('RandAI mirrors the global add FAB on mobile while keeping the cat mascot', () => {
  const randaiCss = compact(css)
  const globalCss = compact(shellCss)
  const responsiveCss = compact(adaptiveCss)

  assert.match(assistant, /\/icons\/randai-cat\.webp/)
  assert.doesNotMatch(assistant, /<span>AI<\/span>/)
  assert.match(randaiCss, /\.randai\{[^}]*left:max\(18px,env\(safe-area-inset-left\)\)[^}]*right:auto/)
  assert.match(randaiCss, /\.randai__fab\{[^}]*width:var\(--rs-fab-h,58px\)[^}]*height:var\(--rs-fab-h,58px\)[^}]*border-radius:20px/)
  assert.match(randaiCss, /@media\(max-width:899px\)\{\.randai\{[^}]*bottom:calc\(58px\+max\(6px,min\(env\(safe-area-inset-bottom,0px\),18px\)\)\+12px\)/)
  assert.match(globalCss, /\.rs-navfab\{[^}]*right:18px/)
  assert.match(globalCss, /\.rs-navfab\{[^}]*width:var\(--rs-fab-h\);height:var\(--rs-fab-h\);border-radius:20px/)
  assert.match(responsiveCss, /\.rs-navfab\{bottom:calc\(58px\+max\(6px,min\(env\(safe-area-inset-bottom,0px\),18px\)\)\+12px\)!important/)
  assert.match(shell, /className="rs-navfab"/)
  assert.match(shell, /data-testid="fab-new"/)
})
