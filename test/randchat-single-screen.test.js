import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const chat = readFileSync(new URL('../src/randapp/chat/RandChat.jsx', import.meta.url), 'utf8')
const list = readFileSync(new URL('../src/randapp/chat/RandChatList.jsx', import.meta.url), 'utf8')
const thread = readFileSync(new URL('../src/randapp/chat/RandChatThread.jsx', import.meta.url), 'utf8')
const scroll = readFileSync(new URL('../src/randapp/chat/useRandChatScroll.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/randapp/chat/randchat.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const chatData = readFileSync(new URL('../src/randapp/chat/chat-data.js', import.meta.url), 'utf8')
const foundation = readFileSync(new URL('../src/randapp/randui/foundation.css', import.meta.url), 'utf8')

test('Shell mounts the canonical rebuilt RandChat runtime', () => {
  assert.match(shell, /import\('\.\/chat\/RandChat\.jsx'\)/)
  assert.match(shell, /if \(view === 'chat'\) return content/)
  assert.match(shell, /rs-content--chat/)
})

test('RandChat separates orchestration, list, thread and scroll controller', () => {
  assert.match(chat, /RandChatList/)
  assert.match(chat, /RandChatThread/)
  assert.match(list, /randchat-list/)
  assert.match(thread, /randchat-thread/)
  assert.match(scroll, /scrollToBottom/)
})

test('desktop uses split view while mobile replaces the list with the open thread', () => {
  assert.match(css, /\.randchat\s*\{[\s\S]*?grid-template-columns:\s*minmax\(270px, 330px\) minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.randchat--thread-open \.randchat-list\s*\{[\s\S]*?display:\s*none;/)
  assert.match(css, /\.randchat--thread-open \.randchat-stage\s*\{[\s\S]*?display:\s*block;/)
})

test('thread owns header notices scrolling history and input panel as physical rows', () => {
  assert.match(css, /\.randchat-thread\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto;/)
  assert.match(css, /\.randchat-messages\s*\{[\s\S]*?grid-row:\s*3;[\s\S]*?overflow-y:\s*auto;/)
  assert.match(css, /\.randchat-input-panel\s*\{[\s\S]*?grid-row:\s*4;/)
})

test('NextChat-style scroll detaches when reading history and exposes return-to-bottom control', () => {
  assert.match(scroll, /autoScrollRef/)
  assert.match(scroll, /distance <= 72/)
  assert.match(thread, /hitBottom/)
  assert.match(thread, /randchat-to-bottom/)
})

test('composer supports auto-grow and Safari IME-safe Enter submission', () => {
  assert.match(thread, /Math\.min\(node\.scrollHeight, 120\)/)
  assert.match(thread, /event\.keyCode === 229/)
  assert.match(thread, /nativeEvent\?\.isComposing/)
  assert.match(thread, /onCompositionStart/)
  assert.match(thread, /onCompositionEnd/)
})

test('replacement runtime keeps groups, E2EE directs and operational actions', () => {
  assert.match(chat, /fetchChatGroups/)
  assert.match(chat, /fetchDmMessages/)
  assert.match(chat, /sendChatMessage/)
  assert.match(chat, /sendDmMessage/)
  assert.match(chat, /ensureRegisteredDmDevice/)
  assert.match(thread, /Crea segnalazione/)
  assert.match(thread, /Bozza procedura/)
  assert.match(thread, /Conserva/)
})

test('group message window loads latest messages then restores chronological order', () => {
  assert.match(chatData, /order\('created_at', \{ ascending: false \}\)/)
  assert.match(chatData, /return \(data \|\| \[\]\)\.reverse\(\)/)
})

test('chat bypasses PageBoundary and owns the full shell viewport above bottom navigation', () => {
  assert.match(foundation, /RandChat full-shell content mode/)
  assert.match(foundation, /\.rs-content\.rs-content--chat\s*\{[\s\S]*?height:\s*100%;[\s\S]*?padding:\s*0 0 calc\(var\(--rs-nav-h\) \+ var\(--rs-adaptive-safe-bottom\)\) !important;/)
})
