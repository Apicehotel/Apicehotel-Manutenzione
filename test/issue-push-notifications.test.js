import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('nuove segnalazioni: invio push ai manutentori anche dopo sync offline', async () => {
  const issues = await readFile(new URL('../src/issues-data.js', import.meta.url), 'utf8')
  assert.match(issues, /export async function notifyIssueCreated\(issue\)/)
  assert.match(issues, /event_type:'issue_created'/)
  assert.match(issues, /await notifyIssueCreated\(created\)/)
  assert.match(issues, /registerOfflineHandler\(ENTITY,async\(op,targetId\)=>op\.action==='create'\?dbInsert\(op\.payload\)/)
})

test('send-push: distingue avvisi urgenti e nuove segnalazioni', async () => {
  const edge = await readFile(new URL('../supabase/functions/send-push/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /\["urgent", "issue_created"\]/)
  assert.match(edge, /const urgent = eventType === "urgent"/)
  assert.match(edge, /Nuova segnalazione/)
  assert.match(edge, /RECIPIENT_ROLES = new Set\(\["manutentore"\]\)/)
  assert.match(edge, /urgent \|\| id !== userData\.user\.id/)
})
