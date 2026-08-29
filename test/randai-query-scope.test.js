import test from 'node:test'
import assert from 'node:assert/strict'
import { detectRandAIIntent, detectRandAISection, filterSensorsBySection, isRandAIFollowUp, resolveRandAIQuery, scopeGuidanceForQuery } from '../supabase/functions/_shared/randai-query-scope.js'

const sensors = [
  { device_id: 'j1', zone: '1° Jazz', semantic_label: 'Circuito/sonda tecnica climatizzazione Jazz P1' },
  { device_id: 'j2', zone: '2° Jazz', semantic_label: 'Circuito/sonda tecnica climatizzazione Jazz P2' },
  { device_id: 'w1', zone: 'Wine', semantic_label: 'Circuito/sonda tecnica Wine tetto 1' },
  { device_id: 'w2', zone: 'Wine', semantic_label: 'Circuito/sonda tecnica Wine tetto 2' },
]

test('richiesta Jazz esclude completamente i sensori Wine', () => {
  assert.equal(detectRandAISection('Dove si trova il motore aria condizionata jazz?'), 'jazz')
  assert.deepEqual(filterSensorsBySection(sensors, 'jazz').map((item) => item.device_id), ['j1', 'j2'])
})

test('richiesta Wine esclude completamente i sensori Jazz', () => {
  assert.equal(detectRandAISection('Temperatura aria Wine'), 'wine')
  assert.deepEqual(filterSensorsBySection(sensors, 'wine').map((item) => item.device_id), ['w1', 'w2'])
})

test('domande di ubicazione sono riconosciute in forme diverse', () => {
  assert.equal(detectRandAIIntent('Dove si trova il motore aria condizionata jazz?'), 'location')
  assert.equal(detectRandAIIntent('Qual è l’ubicazione del motore Jazz?'), 'location')
  assert.equal(detectRandAIIntent('Posizione motore climatizzazione Jazz'), 'location')
  assert.equal(detectRandAIIntent('Come è localizzato il motore Jazz?'), 'location')
  assert.equal(detectRandAIIntent('Come ci arrivo al motore Wine?'), 'location')
})

test('follow-up breve eredita il contesto Wine dello screenshot', () => {
  assert.equal(isRandAIFollowUp('Dove?'), true)
  const resolved = resolveRandAIQuery('Dove?', 'Motore condizionata wine')
  assert.equal(detectRandAISection(resolved), 'wine')
  assert.equal(detectRandAIIntent(resolved), 'location')
  assert.match(resolved, /Motore condizionata wine/)
  assert.match(resolved, /Dove\?/)
})

test('ogni follow-up usa il tema originario ma il proprio intento', () => {
  const location = resolveRandAIQuery('Dove?', 'Motore condizionata wine')
  const temperature = resolveRandAIQuery('E la temperatura?', location)
  const checks = resolveRandAIQuery('Cosa controllo prima?', temperature)
  assert.equal(detectRandAISection(temperature), 'wine')
  assert.equal(detectRandAIIntent(temperature), 'temperature')
  assert.equal(temperature, 'Motore condizionata wine. Follow-up: E la temperatura?')
  assert.equal(detectRandAISection(checks), 'wine')
  assert.equal(detectRandAIIntent(checks), 'general')
  assert.equal(checks, 'Motore condizionata wine. Follow-up: Cosa controllo prima?')
})

test('una nuova domanda esplicita non eredita la sezione precedente', () => {
  assert.equal(isRandAIFollowUp('Temperatura Jazz P3'), false)
  assert.equal(resolveRandAIQuery('Temperatura Jazz P3', 'Motore condizionata wine'), 'Temperatura Jazz P3')
})

test('intento ubicazione non mostra temperature o diagnosi', () => {
  const scoped = scopeGuidanceForQuery({
    query: 'Dove?',
    contextQuery: 'Motore condizionata wine',
    sensors,
    hvacDiagnostic: { section: 'wine', temperatures: [{ temperature: 17 }] },
    memory: [{ solution: 'x' }],
    procedure: { title: 'Wine non raffredda' },
    history: [{ id: 1 }],
  })
  assert.equal(scoped.intent, 'location')
  assert.equal(scoped.section, 'wine')
  assert.deepEqual(scoped.sensors, [])
  assert.equal(scoped.hvacDiagnostic, null)
  assert.equal(scoped.procedure, null)
  assert.deepEqual(scoped.memory, [])
  assert.deepEqual(scoped.history, [])
})

test('diagnosi Jazz mantiene solo dati Jazz e la diagnosi Jazz', () => {
  const scoped = scopeGuidanceForQuery({
    query: 'Camera 3305 Jazz non fredda',
    sensors,
    hvacDiagnostic: { section: 'jazz', floor: 3 },
  })
  assert.equal(scoped.intent, 'diagnostic')
  assert.deepEqual(scoped.sensors.map((item) => item.device_id), ['j1', 'j2'])
  assert.equal(scoped.hvacDiagnostic.section, 'jazz')
})
