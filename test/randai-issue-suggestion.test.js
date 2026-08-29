import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIssueRandAISuggestion } from '../src/randai/issue-suggestion.js'

test('suggerisce controllo a valle quando il circuito Wine è attivo', () => {
  const result = buildIssueRandAISuggestion({
    hvacDiagnostic: {
      section: 'wine', floor: 1, circuit: 'A2', conclusion: 'circuit-on-check-downstream', thresholds_defined: false,
      switch: { status_label: 'ATTIVO' },
      temperatures: [
        { name: 'Tetto 1', temperature: 17 },
        { name: 'Tetto 2', temperature: 16.5 },
        { name: 'Tetto 3', temperature: 18.4 },
      ],
    },
  })
  assert.match(result.text, /A2/)
  assert.match(result.text, /ATTIVO/)
  assert.match(result.text, /distribuzione/)
  assert.match(result.detail, /17 °C/)
  assert.match(result.caution, /soglie caldo\/freddo/i)
})

test('non inventa lo stato Jazz quando interruttore non è mappato', () => {
  const result = buildIssueRandAISuggestion({
    hvacDiagnostic: {
      section: 'jazz', floor: 3, conclusion: 'floor-temperature-available-switch-unmapped', thresholds_defined: false,
      temperatures: [{ name: 'Temp. C/F Jazz P3', temperature: 13.7 }],
    },
  })
  assert.match(result.text, /non è ancora mappato/i)
  assert.doesNotMatch(result.text, /risulta ATTIVO/)
})

test('usa la memoria verificata prima di una procedura generica', () => {
  const result = buildIssueRandAISuggestion({
    memory: [{ solution: 'Controlla il contattore Q2.', cause: 'Contattore Q2', sourceLabel: 'Memoria verificata' }],
    procedure: { summary: 'Procedura generica' },
  })
  assert.equal(result.text, 'Controlla il contattore Q2.')
  assert.equal(result.source, 'Memoria verificata')
})

test('usa il primo passo della procedura quando non ci sono dati diagnostici o memoria', () => {
  const result = buildIssueRandAISuggestion({ procedure: { summary: 'Controllo climatizzazione', steps: ['Verifica alimentazione', 'Verifica valvola'], sourceLabel: 'Procedura interna' } })
  assert.equal(result.text, 'Verifica alimentazione')
  assert.equal(result.source, 'Procedura interna')
})

test('restituisce null senza conoscenza affidabile', () => {
  assert.equal(buildIssueRandAISuggestion({ sensors: [] }), null)
})
