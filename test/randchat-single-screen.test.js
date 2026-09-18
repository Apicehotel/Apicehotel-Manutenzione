import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const chat = readFileSync(new URL('../src/randapp/chat/RandChat.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/randapp/chat/randchat-next.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const chatData = readFileSync(new URL('../src/randapp/chat/chat-data.js', import.meta.url), 'utf8')

test('Shell mounts only the replacement RandChat runtime', () => {
  assert.match(shell, /import\('\.\/chat\/RandChat\.jsx'\)/)
  assert.doesNotMatch(shell, /ChatGroups\.jsx/)
})

test('replacement messenger separates conversation list and thread', () => {
  assert.match(chat, /rnc-root--thread/)
  assert.match(chat, /rnc-list-screen/)
  assert.match(chat, /rnc-thread/)
  assert.match(chat, /backToList/)
})

test('thread is a physical header-history-composer grid', () => {
  assert.match(css, /\.rnc-thread\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto;/)
  assert.match(css, /\.rnc-messages\s*\{[\s\S]*?grid-row:\s*3;[\s\S]*?overflow-y:\s*auto;/)
  assert.match(css, /\.rnc-composer\s*\{[\s\S]*?grid-row:\s*4;/)
})

test('message and thread actions are contextual', () => {
  assert.match(chat, /rnc-message-menu-trigger/)
  assert.match(chat, /rnc-message-menu/)
  assert.match(chat, /rnc-menu-wrap/)
  assert.match(chat, /rnc-menu/)
})

test('replacement runtime keeps groups and E2EE directs', () => {
  assert.match(chat, /fetchChatGroups/)
  assert.match(chat, /fetchDmMessages/)
  assert.match(chat, /sendChatMessage/)
  assert.match(chat, /sendDmMessage/)
  assert.match(chat, /ensureRegisteredDmDevice/)
})

test('group message window loads latest messages then restores chronological order', () => {
  assert.match(chatData, /order\('created_at', \{ ascending: false \}\)/)
  assert.match(chatData, /return \(data \|\| \[\]\)\.reverse\(\)/)
})


test('chat bypasses PageBoundary and owns the full shell content viewport', () => {
  const foundation = readFileSync(new URL('../src/randapp/randui/foundation.css', import.meta.url), 'utf8')
  assert.match(shell, /if \(view === 'chat'\) return content/)
  assert.match(shell, /rs-content--chat/)
  assert.match(foundation, /RandChat full-shell content mode/)
  assert.match(foundation, /\.rs-content\.rs-content--chat\s*\{[\s\S]*?height:\s*100%;[\s\S]*?padding:\s*0 0 calc\(var\(--rs-nav-h\) \+ var\(--rs-adaptive-safe-bottom\)\) !important;/)
})
