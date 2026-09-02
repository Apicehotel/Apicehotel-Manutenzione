import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const consoleSource = await readFile(new URL('../src/randai/control/IssueOperationsConsole.jsx', import.meta.url), 'utf8')
const controlCenter = await readFile(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const actionPolicy = await readFile(new URL('../supabase/functions/_shared/randai-action-policy.js', import.meta.url), 'utf8')

test('Point 3 replaces the plain issue table with the operational issue workspace', () => {
  assert.match(controlCenter, /IssueOperationsConsole/)
  assert.match(controlCenter, /issues: <IssueOperationsConsole/)
  assert.match(consoleSource, /TIMELINE UNIFICATA/)
  assert.match(consoleSource, /Casi simili/)
  assert.match(consoleSource, /Procedure approvate/)
  assert.match(consoleSource, /Possibili impianti correlati/)
})

test('WhatsApp and RandApp share the same issue workspace without a second issue store', () => {
  assert.match(consoleSource, /whatsapp_inbound_messages/)
  assert.match(consoleSource, /\.eq\('issue_id', selected\.id\)/)
  assert.match(consoleSource, /La segnalazione proviene da WhatsApp ed è stata unificata con RandApp/)
  assert.doesNotMatch(consoleSource, /insert\([^)]*segnalazioni/)
})

test('similar cases, procedures and equipment are hotel scoped', () => {
  assert.match(consoleSource, /issue\.hotelId !== candidate\.hotelId/)
  assert.match(consoleSource, /issue\.hotelId !== procedure\.hotel_id/)
  assert.match(consoleSource, /issue\.hotelId !== equipment\.hotel_id/)
  assert.match(consoleSource, /non vengono mai incrociati tra hotel diversi/)
})

test('operational writes use only supported RandAI Action Gateway actions', () => {
  for (const action of ['issue.update_priority', 'issue.set_waiting_part', 'issue.mark_done']) {
    assert.ok(consoleSource.includes(action), `console must use ${action}`)
    assert.ok(actionPolicy.includes(action), `server policy must support ${action}`)
  }
  assert.match(consoleSource, /prepareRandAIAction/)
  assert.match(consoleSource, /executeRandAIAction/)
  assert.match(consoleSource, /rejectRandAIAction/)
  assert.doesNotMatch(consoleSource, /updateIssueRow/)
})

test('the issue context is explicitly published inside the isolated RandAI route', () => {
  assert.match(consoleSource, /createIssueContextEnvelope/)
  assert.match(consoleSource, /publishRandAIContext/)
  assert.match(consoleSource, /no diagnosi inventate/)
})
