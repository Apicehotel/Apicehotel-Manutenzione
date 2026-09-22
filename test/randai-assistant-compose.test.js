import test from 'node:test'
import assert from 'node:assert/strict'
import { composeRandAIAnswer, hvacNextCheck } from '../supabase/functions/_shared/randai-assistant-compose.js'
import { buildHvacDiagnostic } from '../supabase/functions/_shared/hvac-routing.js'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('compose merges HVAC + procedure + memory without short-circuiting on memory alone', () => {
  const composed = composeRandAIAnswer({
    intent: 'general',
    section: 'wine',
    resolvedQuery: 'Camera 125 non fredda',
    memory: [{
      id: 'mem-1',
      symptom: 'Camera Wine non raffresca',
      cause: 'Circuito spento',
      solution: 'Riattivare il circuito A2',
    }],
    hvacDiagnostic: {
      conclusion: 'circuit-off',
      temperatures: [{ alert: false, online: true }],
    },
    procedure: {
      id: 'proc-1',
      title: 'Controllo aria Wine',
      summary: 'Verifica circuito e temperature tetto',
      steps: ['Controlla interruttore zona', 'Verifica temperature tetto'],
      version: 1,
    },
    buildSuggestion: ({ kind, id, title, summary, trust, actionable, nextAction, provenance, caution = null }) => ({
      id: `${kind}:${id}`,
      kind,
      title,
      summary,
      trust,
      actionable,
      nextAction,
      provenance,
      caution,
    }),
  })

  assert.equal(composed.found, true)
  assert.equal(composed.source, 'live_hvac_and_procedure')
  assert.match(composed.headline, /SPENTO|riattivalo/i)
  assert.ok(composed.nextChecks.some((check) => /SPENTO|riattivalo/i.test(check)))
  assert.ok(composed.nextChecks.some((check) => /Procedura:/i.test(check)))
  assert.equal(composed.suggestions.length, 2)
  assert.equal(composed.suggestions[0].kind, 'procedure')
  assert.equal(composed.suggestions[1].kind, 'experience')
})

test('compose returns actionable checklist and found:false when evidence is missing', () => {
  const composed = composeRandAIAnswer({
    intent: 'general',
    resolvedQuery: 'problema generico senza contesto',
  })
  assert.equal(composed.found, false)
  assert.equal(composed.reason, 'no_approved_knowledge')
  assert.ok(composed.nextChecks.length >= 3)
  assert.match(composed.headline, /insufficiente/i)
})

test('hvacNextCheck prioritizes live temperature alerts', () => {
  assert.match(
    hvacNextCheck({
      conclusion: 'circuit-on-check-downstream',
      temperatures: [{ alert: true, online: true }],
    }),
    /ALLERTA/i,
  )
  assert.match(
    hvacNextCheck({ conclusion: 'floor-temperature-available-switch-unmapped', temperatures: [] }),
    /non ancora mappato/i,
  )
})

test('Wine alert temperatures force temperature-alert conclusion after circuit is on', () => {
  const zone = {
    zone_id: 'wine-p1-a2',
    hotel_id: 'hotelgio',
    section: 'wine',
    floor: 1,
    circuit: 'A2',
    label: 'Wine P1 A2',
    room_numbers: [125],
    switch_device_id: 'switch-a2',
    temperature_device_ids: ['roof-1'],
  }
  const now = Date.parse('2026-08-29T18:40:00Z')
  const diagnostic = buildHvacDiagnostic({
    zone,
    room: 125,
    mode: 'cooling',
    now,
    sensors: [
      { device_id: 'roof-1', nome: 'Tetto 1', temperatura: 28, online: true, in_allerta: true, aggiornato_il: '2026-08-29T18:30:00Z' },
      { device_id: 'switch-a2', nome: 'A2', temperatura: null, online: true, switch_state: 'on', in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' },
    ],
  })
  assert.equal(diagnostic.conclusion, 'temperature-alert')
  assert.equal(diagnostic.sensor_alert_active, true)
})

test('assistant edge composes evidence, captures gaps, and never short-circuits on memory alone', async () => {
  const edge = await read('supabase/functions/randai-assistant/index.ts')
  const data = await read('src/randai/randai-data.js')
  const ui = await read('src/randai/RandAIAssistant.jsx')

  assert.match(edge, /composeRandAIAnswer/)
  assert.match(edge, /captureKnowledgeGap/)
  assert.match(edge, /randai_knowledge_gaps/)
  assert.match(edge, /headline: composed\.headline/)
  assert.match(edge, /nextChecks: composed\.nextChecks/)
  assert.match(edge, /gapCaptured/)
  assert.doesNotMatch(edge, /if \(memory\.length\)[\s\S]{0,120}return json/)

  assert.match(data, /headline:/)
  assert.match(data, /nextChecks:/)
  assert.match(data, /gapCaptured:/)
  assert.match(data, /found: false/)

  assert.match(ui, /randai-next-checks/)
  assert.match(ui, /randai-headline/)
  assert.match(ui, /randai-gap-captured/)
  assert.match(ui, /temperature-alert/)
  assert.match(ui, /Non improvviso/)
})
