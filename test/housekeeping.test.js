import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Housekeeping replica Slope, tabellone e sincronizzazione offline', async()=>{
  const [app,source,pkg]=await Promise.all([readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),readFile(new URL('../src/housekeeping.jsx',import.meta.url),'utf8'),readFile(new URL('../package.json',import.meta.url),'utf8')])
  assert.match(app,/hotel\.id === 'hotelgio' && canViewHousekeeping\(user\)/)
  assert.match(app,/<span>Housekeeping<\/span>/)
  assert.match(source,/await import\('xlsx'\)/)
  assert.match(source,/XLSX\.read/)
  assert.match(source,/camere_giorno/)
  assert.match(source,/camere_lavoro/)
  assert.match(source,/carica_camere_giorno/)
  assert.match(source,/new Dexie\('apiceHousekeeping'\)/)
  assert.match(source,/Partenza \+ arrivo/)
  assert.match(source,/Non disturbare/)
  assert.match(pkg,/"dexie"/)
  assert.match(pkg,/"xlsx"/)
})
