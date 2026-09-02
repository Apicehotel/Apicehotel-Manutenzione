import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  KnowledgeTrust,
  MaintenanceKnowledgeEngine,
  ProcedureAssistant,
  RelationType,
  procedureFromRow,
  procedureToRow,
} from '../src/randai/maintenance/index.js'
import { findInternalProcedure, findInternalKnowledge } from '../src/randai/knowledge.js'

test('Procedure Assistant creates only a draft and preserves source evidence', () => {
  const assistant = new ProcedureAssistant()
  const draft = assistant.compose({
    hotelId: 'hotelgio',
    text: 'Il contatore acqua Jazz è nel locale tecnico sotto la scala. Per la lettura usare le cifre nere.',
    hints: {
      title: 'Lettura contatore acqua Jazz',
      category: 'acqua',
      area: 'Jazz',
      equipmentName: 'Contatore acqua Jazz',
      location: 'Locale tecnico sotto la scala',
      steps: ['Entra nel locale tecnico sotto la scala.', 'Leggi le cifre nere del contatore.'],
    },
    attachments: [{ id: 'photo-meter', type: 'photo', label: 'Foto contatore Jazz', uri: 'hotelgio://technical/photo-meter' }],
  })

  assert.equal(draft.trust, KnowledgeTrust.DRAFT)
  assert.equal(draft.requiresApproval, true)
  assert.deepEqual(draft.missingFields, [])
  assert.equal(draft.proposal.equipment.location, 'Locale tecnico sotto la scala')
  assert.equal(draft.proposal.evidence[0].trust, KnowledgeTrust.DRAFT)
})

test('draft knowledge is never returned as an operational fact', () => {
  const engine = new MaintenanceKnowledgeEngine()
  engine.registerProcedure({
    id: 'hotelgio-water-meter', hotelId: 'hotelgio', title: 'Contatore acqua Jazz', category: 'acqua', area: 'Jazz',
    summary: 'Il contatore si trova nel locale tecnico.', keywords: ['contatore', 'acqua', 'jazz'], trust: KnowledgeTrust.DRAFT,
  })
  const result = engine.search({ hotelId: 'hotelgio', query: 'Dove si trova il contatore acqua Jazz?' })
  assert.equal(result.found, false)
  assert.equal(result.trust, KnowledgeTrust.UNKNOWN)
  assert.match(result.message, /non deve inventare/i)
})

test('approved proposal becomes searchable only in its hotel and keeps evidence', () => {
  const engine = new MaintenanceKnowledgeEngine()
  const assistant = new ProcedureAssistant()
  const draft = assistant.compose({
    hotelId: 'hotelgio',
    text: 'Il contatore acqua Jazz è nel locale tecnico sotto la scala. Leggere le cifre nere.',
    hints: {
      title: 'Lettura contatore acqua Jazz', category: 'acqua', area: 'Jazz', equipmentName: 'Contatore acqua Jazz',
      location: 'Locale tecnico sotto la scala', steps: ['Apri il locale tecnico.', 'Leggi le cifre nere.'],
    },
    attachments: [{ id: 'meter-photo', type: 'photo', label: 'Foto identificativa' }],
  })

  const approved = assistant.approve(draft, engine, { approvedBy: 'maintenance-admin' })
  assert.equal(approved.trust, KnowledgeTrust.APPROVED)
  assert.equal(engine.search({ hotelId: 'hotelgio', query: 'contatore acqua Jazz' }).found, true)
  assert.equal(engine.search({ hotelId: 'chocohotel', query: 'contatore acqua Jazz' }).found, false)
  assert.equal(engine.getEvidence({ hotelId: 'hotelgio', procedureId: approved.id })[0].trust, KnowledgeTrust.APPROVED)
  assert.equal(engine.findEquipmentForArea({ hotelId: 'hotelgio', area: 'Jazz' })[0].name, 'Contatore acqua Jazz')
})

test('procedure revisions are versioned, hotel-scoped and require re-approval', () => {
  const engine = new MaintenanceKnowledgeEngine({ procedures: [{
    id: 'hotelgio-valve', hotelId: 'hotelgio', title: 'Valvola generale Jazz', category: 'acqua', area: 'Jazz',
    summary: 'Posizione iniziale verificata.', keywords: ['valvola', 'jazz'], trust: KnowledgeTrust.APPROVED, version: 1,
  }] })

  const revised = engine.reviseProcedure('hotelgio-valve', { summary: 'Nuova posizione da verificare.' }, { hotelId: 'hotelgio', changeNote: 'impianto modificato' })
  assert.equal(revised.version, 2)
  assert.equal(revised.trust, KnowledgeTrust.DRAFT)
  assert.equal(engine.search({ hotelId: 'hotelgio', query: 'valvola Jazz' }).found, false)

  const approved = engine.approveProcedure('hotelgio-valve', { hotelId: 'hotelgio', approvedBy: 'maintenance-admin' })
  assert.equal(approved.version, 2)
  assert.equal(approved.trust, KnowledgeTrust.APPROVED)
  const history = engine.getRevisionHistory('hotelgio-valve', { hotelId: 'hotelgio' })
  assert.ok(history.some((entry) => entry.version === 1 && entry.trust === KnowledgeTrust.OUTDATED))
  assert.ok(history.some((entry) => entry.version === 2 && entry.trust === KnowledgeTrust.APPROVED))
  assert.throws(() => engine.reviseProcedure('hotelgio-valve', {}, { changeNote: 'missing scope' }), /hotelId is required/)
})

test('equipment relationships are hotel scoped', () => {
  const engine = new MaintenanceKnowledgeEngine({
    equipment: [{ id: 'jazz-motor', hotelId: 'hotelgio', name: 'Motore clima Jazz', category: 'climatizzazione', trust: KnowledgeTrust.VERIFIED }],
    relations: [{ hotelId: 'hotelgio', from: 'jazz-motor', to: '3° Jazz', type: RelationType.SERVES }],
  })
  assert.equal(engine.findEquipmentForArea({ hotelId: 'hotelgio', area: '3° Jazz' }).length, 1)
  assert.equal(engine.findEquipmentForArea({ hotelId: 'brigantino', area: '3° Jazz' }).length, 0)
})

test('Supabase adapter preserves the maintenance knowledge contract', () => {
  const row = {
    id: 'p1', hotel_id: 'hotelgio', title: 'Procedura', category: 'acqua', area: 'Jazz', symptom: null,
    summary: 'Test', keywords: ['acqua'], steps: ['Step'], caution: null, source_label: 'Staff', status: 'approved', version: 3,
    approved_at: '2026-08-30T00:00:00Z', created_at: '2026-08-29T00:00:00Z', updated_at: '2026-08-30T00:00:00Z',
  }
  const procedure = procedureFromRow(row)
  assert.equal(procedure.hotelId, 'hotelgio')
  assert.equal(procedure.trust, KnowledgeTrust.APPROVED)
  assert.equal(procedureToRow(procedure).status, 'approved')
  assert.equal(procedureToRow(procedure).hotel_id, 'hotelgio')
})

test('legacy RandAI knowledge uses the same approved-only engine and keeps hotel isolation', () => {
  const gio = findInternalProcedure({ hotelId: 'hotelgio', query: 'Al Jazz i condizionatori non freddano' })
  assert.equal(gio?.id, 'hotelgio-jazz-clima-not-cooling')
  assert.equal(gio?.trust, KnowledgeTrust.APPROVED)
  assert.equal(findInternalProcedure({ hotelId: 'chocohotel', query: 'condizionatori Jazz non freddano' }), null)
  assert.equal(findInternalKnowledge({ hotelId: 'brigantino', query: 'motore climatizzazione Jazz' }).trust, KnowledgeTrust.UNKNOWN)
})

test('database migration adds immutable revision/evidence layers with hotel RLS', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260830050000_randai_maintenance_knowledge_engine.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.randai_procedure_revisions/i)
  assert.match(sql, /create table if not exists public\.randai_knowledge_evidence/i)
  assert.match(sql, /public\.is_hotel_member\(hotel_id\)/i)
  assert.match(sql, /public\.can_admin_hotel\(hotel_id\)/i)
  assert.match(sql, /randai_knowledge_evidence_target/i)
})
