import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')

test('RandAI uses approved cat mascot on the left while global add stays independent', () => {
  assert.match(assistant, /\/icons\/randai-cat\.webp/)
  assert.doesNotMatch(assistant, /<span>AI<\/span>/)
  assert.match(css, /\.randai\{[^}]*left:max\(16px,env\(safe-area-inset-left\)\)[^}]*right:auto/)
  assert.match(css, /\.randai__fab img\{[^}]*width:42px[^}]*height:42px/)
  assert.match(css, /\.randai__fab\{[^}]*width:48px[^}]*height:48px/)
  assert.match(shell, /className="rs-navfab"/)
  assert.match(shell, /data-testid="fab-new"/)
})
