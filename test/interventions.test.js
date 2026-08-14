import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Interventi replica il flusso pianificato di Hotel Gio', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /function InterventionsSection/)
  assert.match(app, /PLANNED_STORAGE_KEY/)
  assert.match(app, /function PlannedCard/)
  assert.match(app, /function PlannedForm/)
  assert.match(app, /function PlannedDetail/)
  assert.match(app, /Da completare/)
  assert.match(app, /Cerca camera, nome, assegnatario/)
  assert.match(app, /Nuovo intervento pianificato/)
  assert.match(app, /draft\.category !== 'Idromassaggio' \|\| \(hotel\.id === 'hotelgio' && group\.name\.startsWith\('Jazz'\)\)/)
  assert.match(app, /Number\(room\) % 2 === 0/)
  assert.match(app, /Periodo previsto/)
  assert.match(app, />Da<input type="datetime-local"/)
  assert.match(app, />A<input type="datetime-local"/)
  assert.match(app, /\['manutentore','Tecnico esterno'\]/)
  assert.match(app, /Assegna a/)
  assert.match(app, /Intervento completato/)
  assert.match(app, /Segnalazioni › Completate/)
  assert.match(app, /roomGroupIds/)
  assert.match(app, /room-checklist/)
  assert.match(app, /Aggiungi foto finale/)
  const detail = app.slice(app.indexOf('function PlannedDetail'), app.indexOf('function InterventionsSection'))
  assert.doesNotMatch(detail, /Serve pezzo|Pezzo sostituito|ATTESA PEZZO/)
  assert.match(detail, /planned-date-range/)
})
