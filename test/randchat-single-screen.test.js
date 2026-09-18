import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entry = readFileSync(new URL('../src/randapp/chat/ChatGroups.jsx', import.meta.url), 'utf8')
const groups = readFileSync(new URL('../src/randapp/chat/GroupChats.jsx', import.meta.url), 'utf8')
const dms = readFileSync(new URL('../src/randapp/chat/DirectMessages.jsx', import.meta.url), 'utf8')
const scrollEngine = readFileSync(new URL('../src/randapp/chat/useChatThreadScroll.js', import.meta.url), 'utf8')
const viewportCss = readFileSync(new URL('../src/randapp/chat/chat-viewport.css', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../src/randapp/chat/chat.css', import.meta.url), 'utf8')
const chatData = readFileSync(new URL('../src/randapp/chat/chat-data.js', import.meta.url), 'utf8')

test('RandChat inherits the canonical RandUI content viewport instead of measuring window geometry', () => {
  assert.doesNotMatch(entry, /window\.visualViewport/)
  assert.doesNotMatch(entry, /--rc-viewport-h/)
  assert.doesNotMatch(entry, /window\.scrollTo/)
  assert.match(entry, /classList\.add\('rs-content--randchat'\)/)
  assert.match(viewportCss, /\.rs-content\.rs-content--randchat\s*\{[^}]*height:\s*100%/is)
  assert.match(viewportCss, /\.rc-module\s*\{[^}]*height:\s*100%/is)
})

test('RandChat leaves scrolling to message and thread areas inside the shell viewport', () => {
  assert.match(viewportCss, /body\.rs-randchat-active\s*\{[^}]*overflow:\s*hidden/is)
  assert.match(viewportCss, /\.rs-content\.rs-content--randchat\s*\{[^}]*padding-bottom:\s*0\s*!important/is)
  assert.match(viewportCss, /\.rc-module \.rc-messages,[\s\S]*?overflow-y:\s*auto/is)
  assert.match(viewportCss, /overscroll-behavior:\s*contain/i)
})

test('RandChat v2 uses one canonical responsive layout without horizontal action clipping', () => {
  assert.match(chatCss, /RandChat v2/)
  assert.match(chatCss, /\.rc-conversation__head\s*\{[\s\S]*?display:\s*grid;/)
  assert.match(chatCss, /\.rc-head-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(chatCss, /@media \(max-width: 430px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(chatCss, /\.rc-head-actions[^}]*overflow:\s*auto/)
})

test('Telegram-style smart thread scrolling is shared by groups and encrypted DMs', () => {
  assert.match(scrollEngine, /distanceFromBottom <= 96/)
  assert.match(scrollEngine, /ownLatest/)
  assert.match(scrollEngine, /scrollToLatest/)
  assert.match(scrollEngine, /markOutgoing/)
  assert.match(groups, /useChatThreadScroll/)
  assert.match(dms, /useChatThreadScroll/)
  assert.match(groups, /className="rc-jump-bottom"/)
  assert.match(dms, /className="rc-jump-bottom"/)
  assert.match(chatCss, /\.rc-jump-bottom\s*\{/)
})


test('group message window is the latest chronological block', () => {
  assert.match(chatData, /order\('created_at', \{ ascending: false \}\)/)
  assert.match(chatData, /return \(data \|\| \[\]\)\.reverse\(\)/)
})
