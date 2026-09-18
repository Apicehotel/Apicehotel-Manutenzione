import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const randaiCss = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const headerCss = await readFile(new URL('../src/randapp/header-mobile.css', import.meta.url), 'utf8')
const shellCss = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')

const compact = (value) => value.replace(/\s+/g, '')

test('RandAI is a native shell page and no longer a floating or header launcher', () => {
  const assistantSource = compact(assistant)
  const panelCss = compact(randaiCss)

  assert.match(shell, /view === 'randai'[\s\S]*<RandAIPage/)
  assert.doesNotMatch(shell, /data-testid="header-randai"/)
  assert.doesNotMatch(shell, /CyberCatOrb/)
  assert.doesNotMatch(shell, /randai-cat\.webp/)

  assert.match(assistant, /className="randai-page-workspace"/)
  assert.doesNotMatch(assistant, /data-testid="randai-fab"/)
  assert.doesNotMatch(assistant, /className="randai__fab"/)
  assert.doesNotMatch(assistantSource, /randai--embedded/)

  assert.doesNotMatch(panelCss, /\.randai__fab/)
  assert.match(panelCss, /\.randai-page-workspace\{/)
})

test('global add action remains the only floating action button', () => {
  const globalCss = compact(shellCss)
  assert.match(shell, /className="rs-navfab"/)
  assert.match(shell, /data-testid="fab-new"/)
  assert.match(globalCss, /\.rs-navfab\{[^}]*position:fixed;[^}]*right:18px/)
})
