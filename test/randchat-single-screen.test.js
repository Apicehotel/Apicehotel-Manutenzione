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

test('RandChat inherits the canonical RandUI viewport without measuring window geometry', () => {
  assert.doesNotMatch(entry, /window\.visualViewport/)
  assert.doesNotMatch(entry, /--rc-viewport-h/)
  assert.doesNotMatch(entry, /window\.scrollTo/)
  assert.match(entry, /classList\.add\('rs-content--randchat'\)/)
  assert.match(viewportCss, /\.rs-content\.rs-content--randchat\s*\{[^}]*height:\s*100%/is)
  assert.match(viewportCss, /\.rc-module\s*\{[^}]*height:\s*100%/is)
})

test('mobile RandChat reserves bottom navigation space so the composer stays visible', () => {
  assert.match(viewportCss, /padding-bottom:\s*calc\(var\(--rs-nav-h\) \+ var\(--rs-adaptive-safe-bottom\) \+ 8px\)\s*!important/i)
  assert.match(viewportCss, /\.rc-module \.rc-messages,[\s\S]*?overflow-y:\s*auto/is)
  assert.match(viewportCss, /overscroll-behavior:\s*contain/i)
})

test('opening a conversation removes list tabs and switches RandChat into thread mode', () => {
  assert.match(entry, /const \[threadOpen, setThreadOpen\] = useState\(false\)/)
  assert.match(entry, /rc-module--thread-open/)
  assert.match(entry, /!threadOpen && <nav className="rc-module-tabs"/)
  assert.match(groups, /onConversationOpenChange\?\.\(Boolean\(selected\)\)/)
  assert.match(dms, /onConversationOpenChange\?\.\(Boolean\(selected\)\)/)
})

test('thread chrome and message actions are contextual instead of permanent toolbars', () => {
  assert.match(groups, /rc-thread-menu-trigger/)
  assert.match(groups, /rc-message-menu-trigger/)
  assert.match(dms, /rc-thread-menu-trigger/)
  assert.match(dms, /rc-message-menu-trigger/)
  assert.match(chatCss, /RandChat v3/)
  assert.match(chatCss, /\.rc-thread-menu\s*\{/)
  assert.match(chatCss, /\.rc-message-menu\s*\{/)
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
