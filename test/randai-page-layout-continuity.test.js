import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  clearRandAIChatMemory,
  readRandAIChatMemory,
  writeRandAIChatMemory,
} from '../src/randai/randai-chat-memory.js'

const css = fs.readFileSync(new URL('../src/randai/randai.css', import.meta.url), 'utf8')
const assistant = fs.readFileSync(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')

test('RandAI page mode fills the shell viewport and docks the composer', () => {
  assert.match(css, /\.randai--page\s*\{[\s\S]*?height:\s*var\(--randai-viewport-h[\s\S]*?!important/)
  assert.match(css, /\.randai--page \.randai__messages\s*\{[\s\S]*?flex:\s*1 1 auto/)
  assert.match(css, /\.rs-content\.rs-content--randai \.rs-randui-page__content > :first-child\s*\{[\s\S]*?height:\s*100% !important/)
  assert.match(css, /\.randai--page \.randai__panel\s*\{[\s\S]*?position:\s*relative !important/)
})

test('RandAI chat memory survives remount for the same hotel/user', () => {
  clearRandAIChatMemory()
  const session = { hotelId: 'hotelgio', userId: 'u1' }
  writeRandAIChatMemory(session, {
    messages: [{ role: 'user', text: 'Camera 125 non fredda' }],
    query: 'bozza',
  })
  const saved = readRandAIChatMemory(session)
  assert.equal(saved.messages.length, 1)
  assert.equal(saved.messages[0].text, 'Camera 125 non fredda')
  assert.equal(saved.query, 'bozza')

  const other = readRandAIChatMemory({ hotelId: 'chocohotel', userId: 'u1' })
  assert.equal(other.messages.length, 0)
  assert.equal(other.query, '')
})

test('RandAI assistant persists page chat through the memory helper', () => {
  assert.match(assistant, /readRandAIChatMemory/)
  assert.match(assistant, /writeRandAIChatMemory/)
  assert.doesNotMatch(assistant, /setMessages\(\[\]\)\s*\n\s*setQuery\(''\)/)
})
