import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const randaiCss = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const chrome = await readFile(new URL('../src/randapp/v2/RandChrome.jsx', import.meta.url), 'utf8')
const v2Css = await readFile(new URL('../src/randapp/randui-v2.css', import.meta.url), 'utf8')

const compact = (value) => value.replace(/\s+/g, '')

test('RandAI is a native header action that opens the dedicated chat page', () => {
  const panelCss = compact(randaiCss)
  const toolbarCss = compact(v2Css)

  assert.match(shell, /data-testid="header-randai"/)
  assert.match(chrome, /className="rv2-topbar__actions"/)
  assert.match(shell, /openRandAIPage/)
  assert.match(shell, /variant="page"/)
  assert.match(shell, /CyberCatOrb/)
  assert.match(shell, /className="rs-cyber-cat-orb"/)
  assert.doesNotMatch(shell, /randai-cat\.webp/)

  assert.match(assistant, /variant = 'overlay'/)
  assert.match(assistant, /variant === 'page'/)
  assert.match(assistant, /data-testid=\{isPage \? 'randai-page' : 'randai-root'\}/)
  assert.doesNotMatch(assistant, /data-testid="randai-fab"/)
  assert.doesNotMatch(assistant, /className="randai__fab"/)

  assert.doesNotMatch(panelCss, /\.randai__fab/)
  assert.match(panelCss, /\.randai\{position:fixed;inset:0;[^}]*pointer-events:none/)
  assert.match(panelCss, /\.randai--page\{/)
  assert.match(panelCss, /\.randai__panel\{position:fixed;[^}]*pointer-events:auto/)

  assert.match(toolbarCss, /\.rv2-topbar__actions\{[^}]*display:flex;[^}]*align-items:center/)
  assert.match(toolbarCss, /\.rv2-randai\{[^}]*width:46px;[^}]*height:46px/)
  assert.match(toolbarCss, /@media\(max-width:899px\)[\s\S]*\.rv2-randai\{display:none\}/)
})

test('global add action remains the only floating action button', () => {
  const globalCss = compact(v2Css)
  assert.match(shell, /className="rv2-fab"/)
  assert.match(shell, /data-testid="fab-new"/)
  assert.match(globalCss, /\.rv2-fab\{[^}]*position:fixed/)
})
