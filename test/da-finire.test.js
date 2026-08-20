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

test('Planning Sale: Modifica una prenotazione esistente (prima esisteva solo Elimina, non si poteva correggere sala/date/cliente)', async () => {
  const planning = await readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8')
  assert.match(planning, /function SaleBookingForm\(\{ isBusy, onClose, onSave, initial \}\) \{/)
  assert.match(planning, /<h2>\{initial\?'Modifica prenotazione':'Nuova prenotazione'\}<\/h2>/)
  assert.match(planning, /\{initial\?'✓ Salva modifiche':'✓ Prenota'\}/)
  // isBusy esclude la prenotazione stessa dal controllo conflitti quando si modifica,
  // altrimenti risulterebbe sempre 'occupata' contro se stessa.
  assert.match(planning, /const isBusy=\(room,dateFrom,dateTo,shift,excludeId\)=>bookings\.filter\(item=>item\.id!==excludeId\)/)
  assert.match(planning, /const \[editingBookingId,setEditingBookingId\]=useState\(null\)/)
  assert.match(planning, /onEdit=\{\(\)=>\{setEditingBookingId\(openBooking\.id\);setOpenBookingId\(null\)\}\}/)
})

test("Planning Sale: prenotazioni cliccabili con dettaglio dedicato, Da finire/Fatto visibili anche ai manutentori (non solo a chi può creare/eliminare)", async () => {
  const [planning, styles] = await Promise.all([
    readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  // canMarkStatus è più ampio di canEdit: i manutentori possono segnare lo stato
  // (fanno il lavoro fisico in sala) anche se non possono creare/eliminare prenotazioni.
  assert.match(planning, /const canMarkStatus=canEdit\|\|user\.role==='manutentore'/)
  assert.match(planning, /const markToFinish=booking=>persist\(bookings\.map\(item=>item\.id===booking\.id\?\{\.\.\.item,status:'da_finire',toFinishBy:user\.name,toFinishAt:Date\.now\(\)\}:item\)\)/)
  assert.match(planning, /const markDone=booking=>persist\(bookings\.map\(item=>item\.id===booking\.id\?\{\.\.\.item,status:'done',doneBy:user\.name,doneAt:Date\.now\(\)\}:item\)\)/)
  // Nuove prenotazioni partono da 'pending', coerente con Planning lavori.
  assert.match(planning, /persist\(\[\{\.\.\.draft,id:Date\.now\(\),status:'pending',createdBy:user\.name,createdAt:Date\.now\(\)\},\.\.\.bookings\]\)/)
  // Ogni prenotazione è ora un pulsante cliccabile che apre il dettaglio, non più solo testo statico.
  assert.match(planning, /<button type="button" className=\{`sale-event \$\{item\.shift\} \$\{item\.status\|\|'pending'\}`\} key=\{item\.id\} onClick=\{\(\)=>setOpenBookingId\(item\.id\)\}>/)
  assert.match(planning, /function SaleBookingDetail\(\{ booking, canMarkStatus, canEdit, onClose, onToFinish, onDone, onDelete, onEdit \}\) \{/)
  assert.match(planning, /\{canMarkStatus && booking\.status !== 'done' && <div className="planned-actions">/)
  // Modifica ed Elimina restano riservate a canEdit (include Direttore Centro Congressi), dentro il dettaglio.
  assert.match(planning, /\{canEdit && <button className="planned-edit" onClick=\{onEdit\}>Modifica<\/button>\}/)
  assert.match(planning, /\{canEdit && <button className="delete-issue-compact" onClick=\{\(\) => \{ onDelete\(booking\); onClose\(\) \}\}>Elimina<\/button>\}/)
  assert.match(styles, /\.sale-event\.da_finire \{ border-color:#fbd7a5; background:#fef6ea; color:#b45309; \}/)
  assert.match(styles, /\.sale-event\.done \{ border-color:#bfe3d1; background:#effaf4; color:#0e5c49; \}/)
})
