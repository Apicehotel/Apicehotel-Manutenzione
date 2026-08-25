import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Housekeeping v2 mantiene offline, privacy, griglia 4/3/2 e ruoli', async()=>{
  const [entry,source,css,pkg,config,helpers,main,alerts,migration] = await Promise.all([
    readFile(new URL('../src/housekeeping.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/housekeeping-v2.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/housekeeping-v2.css',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8'),
    readFile(new URL('../src/config.js',import.meta.url),'utf8'),
    readFile(new URL('../src/randapp/helpers.js',import.meta.url),'utf8'),
    readFile(new URL('../src/main.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/randapp/HousekeepingCompletionAlerts.jsx',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260825201500_housekeeping_completion_realtime.sql',import.meta.url),'utf8'),
  ])

  assert.match(entry,/housekeeping-v2\.jsx/)
  assert.match(source,/new Dexie\(`randappHousekeepingV2-\$\{hotelId\}`\)/)
  assert.match(source,/parseSlopePrivacyRows/)
  assert.match(source,/await import\('xlsx'\)|exportHousekeepingYearXlsx/)
  assert.match(source,/carica_camere_giorno/)
  assert.match(source,/operational_note/)
  assert.doesNotMatch(source,/row\?\.\[8\]|row\[8\]/)
  assert.match(source,/nondist/)
  assert.match(source,/stato_slope==='fermata'/)
  assert.match(source,/channel:'housekeeping'/)
  assert.match(source,/housekeeping_change_events/)

  assert.match(css,/data-ui-size="small"[^}]*\.hk2-grid\{grid-template-columns:repeat\(4/)
  assert.match(css,/data-ui-size="normal"[^}]*\.hk2-grid\{grid-template-columns:repeat\(3/)
  assert.match(css,/data-ui-size="large"[^}]*\.hk2-grid\{grid-template-columns:repeat\(2/)

  assert.match(config,/['"]Capo Governante['"]/)
  assert.match(config,/housekeeping_notifications/)
  assert.match(helpers,/canViewHousekeeping[^\n]*Capo Governante/)
  assert.match(main,/HousekeepingCompletionAlerts/)
  assert.match(alerts,/housekeeping_completions/)
  assert.match(alerts,/Reception/)
  assert.match(migration,/trg_sync_housekeeping_completion_from_work/)
  assert.match(migration,/new\.stato <> 'fatto'/)
  assert.match(pkg,/"dexie"/)
  assert.match(pkg,/"xlsx"/)
})
