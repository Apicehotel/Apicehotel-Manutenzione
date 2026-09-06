import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const adaptive = fs.readFileSync(new URL('../src/randapp/adaptive-layout.css', import.meta.url), 'utf8')
const header = fs.readFileSync(new URL('../src/randapp/header-mobile.css', import.meta.url), 'utf8')
const home = fs.readFileSync(new URL('../src/randapp/home-operational.css', import.meta.url), 'utf8')

test('header and content use the same canonical horizontal gutter with safe areas', () => {
  assert.match(adaptive, /\.rs-content\s*\{[\s\S]*padding-left:\s*max\(var\(--rs-page-pad-x\),\s*var\(--rs-adaptive-safe-left\)\)/)
  assert.match(adaptive, /\.rs-header\s*\{[\s\S]*padding-left:\s*max\(var\(--rs-page-pad-x\),\s*var\(--rs-adaptive-safe-left\)\)/)
  assert.match(adaptive, /\.rs-header\s*\{[\s\S]*padding-right:\s*max\(var\(--rs-page-pad-x\),\s*var\(--rs-adaptive-safe-right\)\)/)
})

test('very narrow phones reflow the operational header before truncating the hotel name', () => {
  assert.match(adaptive, /@media \(max-width:\s*360px\)[\s\S]*\.rs-header--operational\s*\{\s*flex-wrap:\s*wrap/)
  assert.match(header, /\.rs-hotelchip__name-desktop\s*\{[\s\S]*white-space:\s*nowrap/)
  assert.match(header, /\.rs-header--operational \.rs-hotelchip__text\s*\{[\s\S]*text-overflow:\s*clip/)
})

test('Home actions remain inside the page geometry rather than owning custom horizontal margins', () => {
  assert.match(home, /\.rs-workhome__hero-actions\s*\{/)
  assert.doesNotMatch(home, /\.rs-workhome__hero-actions\s*\{[^}]*margin-(left|right)/)
  assert.doesNotMatch(home, /\.rs-workhome\s*\{[^}]*padding-(left|right)/)
})

test('navigation invariants remain documented in the adaptive owner', () => {
  assert.match(adaptive, /Home remains 3 and RandAI remains 5/)
  assert.doesNotMatch(adaptive, /Home remains 3 and Altro remains 5/)
})
