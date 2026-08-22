import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Housekeeping replica Slope, tabellone e sincronizzazione offline', async()=>{
  const [app,source,pkg,config]=await Promise.all([readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),readFile(new URL('../src/housekeeping.jsx',import.meta.url),'utf8'),readFile(new URL('../package.json',import.meta.url),'utf8'),readFile(new URL('../src/config.js',import.meta.url),'utf8')])
  assert.match(app,/const canViewHousekeeping = \(user\) => \['admin','Direzione','Direttore Centro Congressi','Portiere Notturno','Governante','Reception'\]\.includes\(user\.role\)/)
  assert.match(app,/canViewHousekeeping\(user\) \? \['Housekeeping'\] : \[\]/)
  assert.match(source,/\.eq\('hotel_id',hotel\.id\)/)
  assert.doesNotMatch(app,/<span>Housekeeping<\/span>/)
  assert.match(source,/await import\('xlsx'\)/)
  assert.match(source,/XLSX\.read/)
  assert.match(source,/camere_giorno/)
  assert.match(source,/camere_lavoro/)
  assert.match(source,/carica_camere_giorno/)
  assert.match(source,/user\.role === 'Portiere Notturno'/)
  assert.match(config,/export const ROLES = \[[^\]]*'Portiere Notturno'/)
  assert.match(config,/'Portiere Notturno': \['create', 'read_own_hotel'\]/)
  assert.match(source,/new Dexie\('apiceHousekeeping'\)/)
  assert.match(source,/aria-label={`Camera \$\{room\.camera\}/)
  assert.match(source,/aria-pressed={group===item\.name}/)
  assert.match(source,/aria-labelledby="hk-room-title"/)
  assert.match(source,/Partenza \+ arrivo/)
  assert.match(source,/Non disturbare/)
  assert.match(pkg,/"dexie"/)
  assert.match(pkg,/"xlsx"/)
})
