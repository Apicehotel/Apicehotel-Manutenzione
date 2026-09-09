import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { addLayoutItem, createLayoutDocument, normalizeLayoutDocument, summarizeLayout, updateLayoutItem, validateLayoutDocument } from '../src/randsale2d-model.js'

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

test('point 4 integrates editor, porter viewer and optimistic versioned persistence',()=>{
  const ui=read('../src/randapp/planning/RandSale2D.jsx'),card=read('../src/randapp/planning/SaleBookingCard.jsx'),sql=read('../supabase/migrations/20260909120000_randsale2d_snapshots.sql'),css=read('../src/randapp/planning-sale-v2.css')
  assert.match(card,/RandSale2D/);assert.match(ui,/PointerCapture/);assert.match(ui,/Modalità facchini/);assert.match(ui,/expectedVersion/);assert.match(ui,/updateBookingRow/)
  assert.match(sql,/enable row level security/i);assert.match(sql,/sale_layout_version_conflict/);assert.match(sql,/where public\.sale_layout_snapshots\.version=p_expected_version/);assert.match(sql,/has_hotel_role\(p_hotel_id, array\['Direttore Centro Congressi'\]\)/);assert.match(sql,/grant select .* authenticated/i)
  assert.match(css,/safe-area-inset-bottom/);assert.match(css,/var\(--rs-scale\)/);assert.match(css,/touch-action/)
})
