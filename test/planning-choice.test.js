import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Planning: la voce di nav apre una schermata di scelta tra Planning lavori e Planning Sale, come su Home', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /function PlanningChoice\(\{ hotel, onGoWork, onGoSale \}\) \{/)
  assert.match(app, /<strong>Planning lavori<\/strong><span>Interventi programmati e assegnazioni<\/span>/)
  // Planning Sale compare come opzione solo per Hotel Giò, coerente con la sua unica disponibilità lì.
  assert.match(app, /\{hotel\.id === 'hotelgio' && <button type="button" className="dash-card" onClick=\{onGoSale\}>/)
  assert.match(app, /tab === 'Planning' \? <PlanningChoice hotel=\{hotel\} onGoWork=\{goToWorkPlanning\} onGoSale=\{goToPlanning\} \/>/)
})

test('Planning: la voce di nav resta evidenziata anche dentro Planning Lavori/Sale, e il back torna alla scelta (solo Hotel Giò)', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /match: \['Planning', 'Planning Lavori', 'Planning Sale'\]/)
  assert.match(app, /planningBackTarget = hotel\.id === 'hotelgio' \? 'Planning' : 'Segnalazioni'/)
  assert.match(app, /onClick=\{\(\) => setTab\(tab === 'Temperature' \? 'Segnalazioni' : planningBackTarget\)\}/)
  // Niente titolo duplicato: PlanningChoice ha già il proprio <h1>, come Home.
  assert.match(app, /tab !== 'Housekeeping' && tab !== 'Home' && tab !== 'Planning' && <div className="title-row ops-title">/)
})
