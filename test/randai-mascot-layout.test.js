import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const assistant = await readFile(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
const randaiCss = await readFile(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const headerCss = await readFile(new URL('../src/randapp/header-mobile.css', import.meta.url), 'utf8')
const shellCss = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')

const compact = (value) => value.replace(/\s+/g, '')

test('RandAI is a native header action and no longer a floating launcher', () => {
  const assistantSource = compact(assistant)
  const panelCss = compact(randaiCss)
  const toolbarCss = compact(headerCss)

  assert.match(shell, /data-testid="header-randai"/)
  assert.match(shell, /className="rs-header__actions"/)
  assert.match(shell, /new CustomEvent\('randai-toggle'\)/)
  assert.match(shell, /CyberCatOrb/)
  assert.match(shell, /className="rs-cyber-cat-orb"/)
  assert.doesNotMatch(shell, /randai-cat\.webp/)

  assert.match(assistant, /const OPEN_EVENT = 'randai-toggle'/)
  assert.match(assistant, /window\.addEventListener\(OPEN_EVENT, toggle\)/)
  assert.doesNotMatch(assistant, /data-testid="randai-fab"/)
  assert.doesNotMatch(assistant, /className="randai__fab"/)

  assert.doesNotMatch(panelCss, /\.randai__fab/)
  assert.match(panelCss, /\.randai\{position:fixed;inset:0;[^}]*pointer-events:none/)
  assert.match(panelCss, /\.randai__panel\{position:fixed;[^}]*pointer-events:auto/)

  assert.match(toolbarCss, /\.rs-header__actions\{[^}]*display:flex;[^}]*align-items:center/)
  assert.match(toolbarCss, /\.rs-header__randai\{[^}]*width:calc\(44px\*var\(--rs-scale\)\);[^}]*height:calc\(44px\*var\(--rs-scale\)\)/)
  assert.match(toolbarCss, /@media\(max-width:899px\)[\s\S]*\.rs-header__randai,[^}]*\{[^}]*width:var\(--rs-header-action-size\)/)
})

test('global add action remains the only floating action button', () => {
  const globalCss = compact(shellCss)
  assert.match(shell, /className="rs-navfab"/)
  assert.match(shell, /data-testid="fab-new"/)
  assert.match(globalCss, /\.rs-navfab\{[^}]*position:fixed;[^}]*right:18px/)
})
