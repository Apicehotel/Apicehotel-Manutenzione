import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildContextAnalysis,
  buildTimeline,
  equipmentScore,
  procedureScore,
  rankEquipment,
  rankProcedures,
  rankSimilarIssues,
  relatedDocuments,
  similarScore,
} from '../src/randai/control/issue-operations-core.js'
import {
  ACTION_DEFINITIONS,
  buildIssuePatch,
  sanitizeActionRequest,
  validateIssueTransition,
  verifyAppliedIssueAction,
} from '../supabase/functions/_shared/randai-action-policy.js'

const consoleSource = await readFile(new URL('../src/randai/control/IssueOperationsConsole.jsx', import.meta.url), 'utf8')
const controlCenter = await readFile(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')

const gioIssue = {
  id: 'gio-1', hotelId: 'hotelgio', title: 'Luce bagno non funziona', category: 'elettrico', room: '1101', status: 'pending', urgency: 'alta', origin: 'WhatsApp', createdAt: '2026-09-01T10:00:00Z',
}
const gioDone = {
  id: 'gio-2', hotelId: 'hotelgio', title: 'Luce bagno fulminata', category: 'elettrico', room: '1101', status: 'done', completedAt: '2026-08-30T10:00:00Z',
}
const chocoIssue = {
  id: 'choco-1', hotelId: 'chocohotel', title: 'Luce bagno non funziona', category: 'elettrico', room: '201', status: 'done', completedAt: '2026-08-31T10:00:00Z',
}

test('Point 3 is wired into the RandAI issue route and uses the controlled action gateway', () => {
  assert.match(controlCenter, /import IssueOperationsConsole from ['"]\.\/IssueOperationsConsole\.jsx['"]/)
  assert.match(controlCenter, /<IssueOperationsConsole\b/)
  assert.match(consoleSource, /from ['"]\.\.\/action-gateway\.js['"]/)
  assert.match(consoleSource, /prepareRandAIAction/)
  assert.match(consoleSource, /executeRandAIAction/)
  assert.match(consoleSource, /rejectRandAIAction/)
  assert.doesNotMatch(consoleSource, /\.from\(['"]segnalazioni['"]\)\s*\.update\(/)
  assert.doesNotMatch(consoleSource, /\.from\(['"]segnalazioni['"]\)\s*\.insert\(/)
})

test('same-hotel scoring is deterministic and cross-hotel candidates are impossible matches', () => {
  assert.ok(similarScore(gioIssue, gioDone) >= 4)
  assert.equal(similarScore(gioIssue, chocoIssue), -1)
  assert.deepEqual(rankSimilarIssues(gioIssue, [chocoIssue, gioDone]), [gioDone])

  const gioProcedure = { id: 'p1', hotel_id: 'hotelgio', status: 'approved', title: 'Verifica luce bagno', category: 'elettrico', summary: 'Controllo lampada' }
  const chocoProcedure = { ...gioProcedure, id: 'p2', hotel_id: 'chocohotel' }
  assert.ok(procedureScore(gioIssue, gioProcedure) >= 2)
  assert.equal(procedureScore(gioIssue, chocoProcedure), -1)
  assert.deepEqual(rankProcedures(gioIssue, [chocoProcedure, gioProcedure]), [gioProcedure])

  const gioEquipment = { id: 'e1', hotel_id: 'hotelgio', active: true, name: 'Quadro piano', category: 'elettrico', location: '1101 corridoio' }
  const chocoEquipment = { ...gioEquipment, id: 'e2', hotel_id: 'chocohotel' }
  assert.ok(equipmentScore(gioIssue, gioEquipment) >= 2)
  assert.equal(equipmentScore(gioIssue, chocoEquipment), -1)
  assert.deepEqual(rankEquipment(gioIssue, [chocoEquipment, gioEquipment]), [gioEquipment])
})

test('documents and WhatsApp timeline stay scoped to the selected hotel and issue', () => {
  const procedures = [{ id: 'p1' }]
  const equipment = [{ id: 'e1' }]
  const docs = [
    { id: 'd1', hotel_id: 'hotelgio', procedure_id: 'p1' },
    { id: 'd2', hotel_id: 'chocohotel', procedure_id: 'p1' },
    { id: 'd3', hotel_id: 'hotelgio', equipment_id: 'e1' },
  ]
  assert.deepEqual(relatedDocuments(gioIssue, docs, procedures, equipment).map((item) => item.id), ['d1', 'd3'])

  const timeline = buildTimeline(gioIssue, [
    { id: 'w1', hotel_id: 'hotelgio', issue_id: 'gio-1', body: 'camera 1101 luce bagno', received_at: '2026-09-01T09:59:00Z' },
    { id: 'w2', hotel_id: 'chocohotel', issue_id: 'gio-1', body: 'wrong hotel', received_at: '2026-09-01T09:58:00Z' },
    { id: 'w3', hotel_id: 'hotelgio', issue_id: 'gio-999', body: 'wrong issue', received_at: '2026-09-01T09:57:00Z' },
  ])
  assert.ok(timeline.some((event) => event.id === 'wa-w1'))
  assert.ok(!timeline.some((event) => event.id === 'wa-w2'))
  assert.ok(!timeline.some((event) => event.id === 'wa-w3'))
})

test('context analysis reports evidence without inventing a diagnosis', () => {
  const analysis = buildContextAnalysis(gioIssue, [gioDone], [{ title: 'Procedura luce' }], [])
  assert.ok(analysis.facts.some((fact) => fact.includes('WhatsApp')))
  assert.ok(analysis.facts.some((fact) => fact.includes('casi simili')))
  assert.match(analysis.next, /Procedura luce/)
  assert.ok(!analysis.facts.some((fact) => /causa certa|diagnosi certa/i.test(fact)))
})

test('Action Gateway contract sanitizes, applies and verifies all Point 3 writes', () => {
  assert.deepEqual(Object.keys(ACTION_DEFINITIONS).sort(), ['issue.mark_done', 'issue.set_waiting_part', 'issue.update_priority'].sort())

  const row = { id: 'gio-1', hotel_id: 'hotelgio', camera: '1101', urgenza: 'media', categoria: 'elettrico', stato: 'pending', updated_at: '2026-09-01T10:00:00Z' }
  const now = '2026-09-02T10:00:00Z'

  const priority = sanitizeActionRequest({ type: 'issue.update_priority', resource_id: row.id, input: { priority: 'ALTA' } })
  assert.equal(priority.input.priority, 'alta')
  assert.deepEqual(buildIssuePatch(priority, 'Admin', now), { urgenza: 'alta' })
  assert.equal(verifyAppliedIssueAction({ ...row, urgenza: 'alta' }, priority), true)

  const waiting = sanitizeActionRequest({ type: 'issue.set_waiting_part', resource_id: row.id, input: { part_name: 'Lampada LED' } })
  assert.equal(validateIssueTransition(row, waiting).ok, true)
  const waitingPatch = buildIssuePatch(waiting, 'Admin', now)
  assert.equal(waitingPatch.stato, 'waiting')
  assert.equal(waitingPatch.pezzo_nome, 'Lampada LED')
  assert.equal(verifyAppliedIssueAction({ ...row, ...waitingPatch }, waiting), true)

  const done = sanitizeActionRequest({ type: 'issue.mark_done', resource_id: row.id, input: { completion_note: 'Sostituita lampada' } })
  assert.equal(validateIssueTransition(row, done).ok, true)
  const donePatch = buildIssuePatch(done, 'Admin', now)
  assert.equal(donePatch.stato, 'done')
  assert.equal(verifyAppliedIssueAction({ ...row, ...donePatch }, done), true)

  assert.equal(sanitizeActionRequest({ type: 'issue.update_priority', resource_id: row.id, input: { priority: 'critica' } }), null)
  assert.equal(validateIssueTransition({ ...row, stato: 'done' }, waiting).ok, false)
  assert.equal(validateIssueTransition({ ...row, stato: 'done' }, done).ok, false)
})
