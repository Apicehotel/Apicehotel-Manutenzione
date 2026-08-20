import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("Planning lavori: azione 'Segna da finire' accanto a 'Intervento completato', per lavori iniziati ma non completabili oggi", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /const markToFinish = \(\) => onUpdate\(\{ status:'da_finire', toFinishBy:user\.name, toFinishAt:Date\.now\(\) \}, false\)/)
  assert.match(app, /<button className="secondary to-finish-action" onClick=\{markToFinish\}>◐ Segna da finire<\/button>/)
  assert.match(app, /item\.status === 'da_finire' && <div className="status-note to-finish">Segnato da finire da <strong>\{item\.toFinishBy\}<\/strong>/)
  // Badge nella card e nel calendario giorno-per-giorno.
  assert.match(app, /item\.status === 'waiting' \? 'Attesa pezzo' : item\.status === 'da_finire' \? 'Da finire' : 'Pianificato'/)
  assert.match(styles, /\.work-event\.da_finire \{ border-color:#fbd7a5; background:#fef6ea; \}/)
  assert.match(styles, /\.planned-badges span\.da_finire \{ background:#fef3e2; color:#b45309; \}/)
})

test('Planning lavori: da_finire persiste su Supabase (nuove colonne da_finire_da/da_finire_il), non solo in stato locale', async () => {
  const plannedData = await readFile(new URL('../src/planned-data.js', import.meta.url), 'utf8')
  assert.match(plannedData, /toFinishBy: row\.da_finire_da \|\| null,/)
  assert.match(plannedData, /toFinishAt: row\.da_finire_il \? new Date\(row\.da_finire_il\)\.getTime\(\) : null,/)
  assert.match(plannedData, /set\('da_finire_da', item\.toFinishBy\)/)
  assert.match(plannedData, /if \(item\.toFinishAt !== undefined\) row\.da_finire_il = item\.toFinishAt \? new Date\(item\.toFinishAt\)\.toISOString\(\) : null/)
})

test("Planning Sale: stesso meccanismo Da finire/Fatto sulle prenotazioni, inline su ogni voce del calendario", async () => {
  const [planning, styles] = await Promise.all([
    readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(planning, /const markToFinish=booking=>persist\(bookings\.map\(item=>item\.id===booking\.id\?\{\.\.\.item,status:'da_finire',toFinishBy:user\.name,toFinishAt:Date\.now\(\)\}:item\)\)/)
  assert.match(planning, /const markDone=booking=>persist\(bookings\.map\(item=>item\.id===booking\.id\?\{\.\.\.item,status:'done',doneBy:user\.name,doneAt:Date\.now\(\)\}:item\)\)/)
  // Nuove prenotazioni partono da 'pending', coerente con Planning lavori.
  assert.match(planning, /persist\(\[\{\.\.\.draft,id:Date\.now\(\),status:'pending',createdBy:user\.name,createdAt:Date\.now\(\)\},\.\.\.bookings\]\)/)
  // Azioni visibili solo a chi può modificare (canEdit), non a chi ha solo sola visualizzazione.
  assert.match(planning, /\{canEdit&&<div className="sale-event-actions">/)
  assert.match(styles, /\.sale-event\.da_finire \{ border-color:#fbd7a5; background:#fef6ea; color:#b45309; \}/)
  assert.match(styles, /\.sale-event\.done \{ border-color:#bfe3d1; background:#effaf4; color:#0e5c49; \}/)
})
