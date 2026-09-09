import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRandSale2DProposal, validateRandSale2DProposal } from '../src/randsale2d-ai-proposal.js'
import { addLayoutItem, bindLayoutDocument, createLayoutDocument, normalizeLayoutDocument, summarizeLayout, updateLayoutItem, validateLayoutDocument } from '../src/randsale2d-model.js'

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8')

test('RandSale 2D keeps a renderer-independent centimetre document inside room bounds',()=>{
  let doc=createLayoutDocument({roomKey:'guitar',layoutKey:'platea',pax:80})
  doc=addLayoutItem(doc,'table');const table=doc.items[0]
  doc=updateLayoutItem(doc,table.id,{x:99999,y:-50,rotation:47})
  assert.equal(doc.unit,'cm');assert.equal(doc.schemaVersion,1);assert.equal(doc.items[0].x,doc.room.width-doc.items[0].width);assert.equal(doc.items[0].y,0);assert.equal(doc.items[0].rotation,45);assert.equal(validateLayoutDocument(doc).valid,true)
})

test('invalid and unknown stored objects are normalized safely',()=>{
  const doc=normalizeLayoutDocument({room:{width:1,height:99999},items:[{type:'unknown'},{type:'chair',width:-1,height:9000}]})
  assert.equal(doc.room.width,300);assert.equal(doc.room.height,5000);assert.equal(doc.items.length,1);assert.deepEqual(summarizeLayout(doc),[{type:'chair',label:'Sedia',count:1}])
})

test('booking metadata stays authoritative when a stored drawing is opened or saved',()=>{
  const doc=bindLayoutDocument(createLayoutDocument({roomKey:'old',layoutKey:'old'}),{roomKey:'sax',room:'Sax',layoutKey:'platea',layout:'Platea',pax:80})
  assert.equal(doc.roomKey,'sax');assert.equal(doc.roomName,'Sax');assert.equal(doc.layoutKey,'platea');assert.equal(doc.layoutName,'Platea');assert.equal(doc.pax,80)
})

test('point 4 integrates editor, porter viewer and optimistic versioned persistence',()=>{
  const ui=read('../src/randapp/planning/RandSale2D.jsx'),card=read('../src/randapp/planning/SaleBookingCard.jsx'),sql=read('../supabase/migrations/20260909120000_randsale2d_snapshots.sql'),css=read('../src/randapp/planning-sale-v2.css')
  assert.match(card,/RandSale2D/);assert.match(ui,/PointerCapture/);assert.match(ui,/Modalità facchini/);assert.match(ui,/expectedVersion/)
  assert.match(sql,/enable row level security/i);assert.match(sql,/sale_layout_version_conflict/);assert.match(sql,/where public\.sale_layout_snapshots\.version=p_expected_version/);assert.match(sql,/has_hotel_role\(p_hotel_id, array\['Direttore Centro Congressi'\]\)/);assert.match(sql,/grant select .* authenticated/i)
  assert.match(css,/safe-area-inset-bottom/);assert.match(css,/var\(--rs-scale\)/);assert.match(css,/touch-action/)
})

test('point 5 keeps RandSale 2D inside Planning cards and leaves completion in the canonical workflow',()=>{
  const ui=read('../src/randapp/planning/RandSale2D.jsx'),card=read('../src/randapp/planning/SaleBookingCard.jsx'),hardening=read('../supabase/migrations/20260909130000_randsale2d_planning_integration.sql')
  assert.match(card,/Modifica pianta 2D/);assert.match(card,/setStatus\('da_finire'\)/);assert.match(card,/setStatus\('done'\)/)
  assert.doesNotMatch(ui,/updateBookingRow/);assert.match(ui,/Modalità facchini · sola lettura/);assert.match(ui,/bindLayoutDocument/)
  assert.match(hardening,/has_app_permission\(p_hotel_id, 'planning_sale', 'manage'\)/);assert.match(hardening,/has_app_permission\(hotel_id, 'planning_sale', 'view'\)/)
  assert.match(hardening,/'roomKey', v_booking\.sala_key/);assert.match(hardening,/'layoutKey', v_booking\.allestimento_key/);assert.match(hardening,/'pax', v_booking\.pax/)
})

test('point 6 keeps append-only history and restores by creating a new version',()=>{
  const ui=read('../src/randapp/planning/RandSale2D.jsx'),data=read('../src/randsale2d-data.js'),sql=read('../supabase/migrations/20260909140000_randsale2d_history.sql')
  assert.match(sql,/sale_layout_snapshot_history/);assert.match(sql,/unique \(booking_id, version\)/);assert.match(sql,/after insert or update of document, version/)
  assert.match(sql,/restore_sale_layout_snapshot/);assert.match(sql,/Ripristino dalla versione/);assert.doesNotMatch(sql,/delete from public\.sale_layout_snapshot_history/i)
  assert.match(data,/fetchSaleLayoutHistory/);assert.match(data,/save_sale_layout_snapshot_v2/);assert.match(data,/restoreSaleLayoutSnapshot/)
  assert.match(ui,/Storico versioni/);assert.match(ui,/Motivo modifica/);assert.match(ui,/Ripristina/);assert.match(ui,/expectedVersion:snapshot\.version/)
})

test('point 7 creates a human-reviewed RandAI draft without bypassing editor or save',()=>{
  const proposal=createRandSale2DProposal({booking:{roomKey:'sax',room:'Sax',layoutKey:'platea',layout:'Platea',pax:80},prompt:'80 persone a platea, palco 4x2 sul fondo, tavolo relatori, buffet vicino ingresso e passaggio centrale'})
  assert.equal(proposal.status,'DRAFT');assert.equal(proposal.authority,'HUMAN_APPROVAL_REQUIRED');assert.equal(validateRandSale2DProposal(proposal),true)
  assert.equal(proposal.document.roomKey,'sax');assert.equal(proposal.document.layoutKey,'platea');assert.equal(proposal.document.pax,80)
  assert.ok(proposal.document.items.some(item=>item.type==='stage'));assert.ok(proposal.document.items.some(item=>item.type==='buffet'));assert.ok(proposal.document.items.some(item=>item.type==='chair'))
  const ui=read('../src/randapp/planning/RandSale2D.jsx')
  assert.match(ui,/Proposta RandAI/);assert.match(ui,/Genera bozza/);assert.match(ui,/Usa questa bozza nell.editor/);assert.match(ui,/Bozza · non salvata/)
  assert.doesNotMatch(read('../src/randsale2d-ai-proposal.js'),/saveSaleLayoutSnapshot|supabase\.rpc|updateBookingRow/)
})
