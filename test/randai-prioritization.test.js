import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const fn = fs.readFileSync(new URL('../supabase/functions/randai-operational-priority/index.ts', import.meta.url), 'utf8')
const card = fs.readFileSync(new URL('../src/randapp/RandAIPriorityCard.jsx', import.meta.url), 'utf8')
const home = fs.readFileSync(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8')

test('block 32 is recommendation-first and explainable', () => {
  assert.match(fn, /policy: "recommendation_first"/)
  assert.match(fn, /reasons: string\[\]/)
  assert.match(fn, /blockers: string\[\]/)
  assert.match(fn, /actionable/)
  assert.match(fn, /randai_memory/)
})

test('blocked work cannot outrank actionable work only by raw score', () => {
  assert.match(fn, /if \(a\.actionable !== b\.actionable\) return a\.actionable \? -1 : 1/)
  assert.match(fn, /in attesa di ricambio/)
  assert.match(fn, /tecnico esterno già atteso/)
})

test('home exposes RandAI next-work recommendation without auto assignment', () => {
  assert.match(card, /Prossimo lavoro consigliato/)
  assert.match(card, /assignmentSuggestion/)
  assert.match(home, /<RandAIPriorityCard/)
  assert.doesNotMatch(card, /updateIssueRow|updateIssue|supabase\.from|\.update\(|\.insert\(|\.upsert\(/i)
})
