import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Group 2 never reports push delivery when there is no recipient', () => {
  const source = read('supabase/functions/send-push/index.ts')
  assert.match(source, /status: "blocked", error: "no_recipient"/)
  assert.match(source, /status: "blocked", error: "no_subscription"/)
  assert.doesNotMatch(source, /status: "sent", sent: 0, note: "nessun destinatario push"/)
  assert.doesNotMatch(source, /status: "sent", sent: 0, note: "nessun abbonamento push registrato"/)
})

test('Group 2 keeps internal chat and Repo Radar bounded', () => {
  const chat = read('src/randapp/chat/randchat-ai.js')
  const workflow = read('.github/workflows/repo-radar.yml')
  const radar = read('scripts/repo-radar-snapshot.mjs')
  assert.match(chat, /rand-gateway|RandGateway/i)
  assert.match(workflow, /schedule:/)
  assert.match(radar, /GitHub|GitLab|Codeberg|npm/)
  assert.match(radar, /Aggiungi|Sostituisci|Ignora|WATCH|REPLACE/i)
})
