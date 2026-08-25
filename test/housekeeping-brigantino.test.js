import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBrigantinoDescription, parseBrigantinoBookingRows } from '../src/housekeeping-brigantino.js'

test('Brigantino normalizza letto fisso e ignora i suffissi numerici',()=>{
  assert.deepEqual(normalizeBrigantinoDescription('115*'),{key:'LETTO_FISSO',label:'Letto fisso',fixedBed:true,source:'115*'})
  assert.equal(normalizeBrigantinoDescription('A-MA1').label,'A-MA')
  assert.equal(normalizeBrigantinoDescription('A-MA2').label,'A-MA')
  assert.equal(normalizeBrigantinoDescription('OV46').label,'OV')
  assert.equal(normalizeBrigantinoDescription('(n.a.)'),null)
  assert.equal(normalizeBrigantinoDescription('TOTALI'),null)
})

test('Brigantino riconosce la matrice Prenotazioni e accorpa i codici equivalenti',()=>{
  const rows=[
    ['DESCRIZIONE','25/08/2026','25/08/2026','25/08/2026'],
    ['', '(room nights)','(presenze)','(revenue)'],
    ['115*',1,2,100],
    ['117*',1,1,90],
    ['A-MA1',2,4,200],
    ['A-MA2',3,5,300],
    ['OV46',1,1,50],
    ['OV47',2,2,70],
    ['TOTALI',10,15,810],
  ]
  const report=parseBrigantinoBookingRows(rows)
  assert.equal(report.kind,'brigantino-report')
  const byLabel=Object.fromEntries(report.rows.map((row)=>[row[0],row]))
  assert.deepEqual(byLabel['Letto fisso'],['Letto fisso',2,3,190])
  assert.deepEqual(byLabel['A-MA'],['A-MA',5,9,500])
  assert.deepEqual(byLabel.OV,['OV',3,3,120])
})
