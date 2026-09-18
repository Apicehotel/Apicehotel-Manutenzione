import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../src/randapp/chat/ChatGroups.jsx', import.meta.url), 'utf8')
const viewportCss = readFileSync(new URL('../src/randapp/chat/chat-viewport.css', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../src/randapp/chat/chat.css', import.meta.url), 'utf8')

test('RandChat inherits the canonical RandUI content viewport instead of measuring window geometry', () => {
  assert.doesNotMatch(component, /window\.visualViewport/)
  assert.doesNotMatch(component, /--rc-viewport-h/)
  assert.doesNotMatch(component, /window\.scrollTo/)
  assert.match(component, /classList\.add\('rs-content--randchat'\)/)
  assert.match(component, /import '\.\/chat\.css'\s*\nimport '\.\/chat-viewport\.css'/)
  assert.match(viewportCss, /\.rs-content\.rs-content--randchat\s*\{[^}]*height:\s*100%/is)
  assert.match(viewportCss, /\.rc-module\s*\{[^}]*height:\s*100%/is)
})

test('RandChat leaves scrolling to message and thread areas inside the shell viewport', () => {
  assert.match(viewportCss, /body\.rs-randchat-active\s*\{[^}]*overflow:\s*hidden/is)
  assert.match(viewportCss, /\.rs-content\.rs-content--randchat\s*\{[^}]*padding-bottom:\s*0\s*!important/is)
  assert.match(viewportCss, /\.rc-module \.rc-messages,[\s\S]*?overflow-y:\s*auto/is)
  assert.match(viewportCss, /overscroll-behavior:\s*contain/i)
})

test('RandChat mobile toolbar stays inside RandUI gutters without horizontal clipping', () => {
  assert.match(chatCss, /RandUI mobile chat alignment override/)
  assert.match(chatCss, /\.rc-conversation__head\s*\{[\s\S]*?display:\s*grid;/)
  assert.match(chatCss, /\.rc-head-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(chatCss, /@media \(max-width: 430px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(chatCss.match(/RandUI mobile chat alignment override[\s\S]*$/)?.[0] || '', /\.rc-head-actions[^}]*overflow:\s*auto/)
})
